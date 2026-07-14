import dagre from 'dagre';
import type { Edge, Node } from 'reactflow';
import {
  GraphTraversalEdge,
  GraphTraversalResponse,
  GraphWordDetailsResponse,
} from '@/types/graph';

export type GraphMode = 'ancestors' | 'descendants' | 'borrowings' | 'cognates';

export interface FlowGraph {
  nodes: Node[];
  edges: Edge[];
}

interface SearchResult {
  wordId: string;
  textOriginal: string;
  language: string;
}

interface SearchResponse {
  results: SearchResult[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 70;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function fetchWordLabel(wordId: string): Promise<string> {
  try {
    const details = await fetchJson<GraphWordDetailsResponse>(
      `${API_BASE}/v1/words/${encodeURIComponent(wordId)}`
    );
    return details.textOriginal || wordId;
  } catch {
    return wordId;
  }
}

function collectWordIds(rootWordId: string, edges: GraphTraversalEdge[]): string[] {
  const ids = new Set<string>([rootWordId]);
  edges.forEach((edge) => {
    ids.add(edge.fromWordId);
    ids.add(edge.toWordId);
  });
  return [...ids];
}

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40, marginx: 20, marginy: 20 });

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  return nodes.map((node) => {
    const position = graph.node(node.id);
    return {
      ...node,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
    };
  });
}

function buildFlowGraph(
  rootWordId: string,
  edges: GraphTraversalEdge[],
  labelsById: Map<string, string>,
  mode: GraphMode
): FlowGraph {
  const nodeIds = collectWordIds(rootWordId, edges);

  const nodes: Node[] = nodeIds.map((id) => ({
    id,
    data: { label: labelsById.get(id) ?? id },
    position: { x: 0, y: 0 },
    style: {
      borderRadius: 12,
      border: '1px solid oklch(0.556 0 0)',
      background: id === rootWordId ? 'oklch(0.922 0 0)' : 'oklch(0.205 0 0)',
      color: id === rootWordId ? 'oklch(0.205 0 0)' : 'oklch(0.985 0 0)',
      padding: 8,
      fontSize: 12,
      width: NODE_WIDTH,
    },
  }));

  const flowEdges: Edge[] = edges.map((edge) => ({
    id: edge.edgeId,
    source: edge.fromWordId,
    target: edge.toWordId,
    label: edge.relationType,
    data: { relationType: edge.relationType, mode },
    animated: false,
    style: {
      opacity: Math.max(0.35, Math.min(1, edge.confidence ?? 0.7)),
      strokeWidth: 1.6,
    },
  }));

  return {
    nodes: applyDagreLayout(nodes, flowEdges),
    edges: flowEdges,
  };
}

export function mergeFlowGraphs(graphs: Array<FlowGraph | null | undefined>): FlowGraph {
  const nodesById = new Map<string, Node>();
  const edgesById = new Map<string, Edge>();

  for (const graph of graphs) {
    if (!graph) continue;
    for (const node of graph.nodes) {
      if (!nodesById.has(node.id)) {
        nodesById.set(node.id, node);
      }
    }
    for (const edge of graph.edges) {
      if (!edgesById.has(edge.id)) {
        edgesById.set(edge.id, edge);
      }
    }
  }

  return {
    nodes: applyDagreLayout([...nodesById.values()], [...edgesById.values()]),
    edges: [...edgesById.values()],
  };
}

class GraphService {
  private async searchWordCandidates(word: string): Promise<SearchResult[]> {
    const response = await fetchJson<SearchResponse>(
      `${API_BASE}/v1/search?q=${encodeURIComponent(word)}&limit=10`
    );
    return response.results ?? [];
  }

  async fetchTraversal(
    mode: GraphMode,
    rootWordId: string,
    depth = 6
  ): Promise<GraphTraversalResponse> {
    return fetchJson<GraphTraversalResponse>(
      `${API_BASE}/v1/graph/${mode}/${encodeURIComponent(rootWordId)}?depth=${depth}`
    );
  }

  async fetchAncestors(rootWordId: string, depth = 6): Promise<GraphTraversalResponse> {
    return this.fetchTraversal('ancestors', rootWordId, depth);
  }

  async fetchDescendants(rootWordId: string, depth = 4): Promise<GraphTraversalResponse> {
    return this.fetchTraversal('descendants', rootWordId, depth);
  }

  async fetchBorrowings(rootWordId: string, depth = 4): Promise<GraphTraversalResponse> {
    return this.fetchTraversal('borrowings', rootWordId, depth);
  }

  async fetchCognates(rootWordId: string, depth = 3): Promise<GraphTraversalResponse> {
    return this.fetchTraversal('cognates', rootWordId, depth);
  }

  async fetchTraversalFlow(
    mode: GraphMode,
    rootWordId: string,
    depth = 6
  ): Promise<FlowGraph> {
    const response = await this.fetchTraversal(mode, rootWordId, depth);
    const wordIds = collectWordIds(rootWordId, response.edges);

    const labels = await Promise.all(
      wordIds.map(async (id) => [id, await fetchWordLabel(id)] as const)
    );

    return buildFlowGraph(rootWordId, response.edges, new Map(labels), mode);
  }

  async fetchAncestorsFlow(
    rootWordId: string,
    depth = 6,
    fallbackWord?: string | null
  ): Promise<FlowGraph> {
    let resolvedRootWordId = rootWordId;
    let response = await this.fetchTraversal('ancestors', resolvedRootWordId, depth);

    if ((response.edges?.length ?? 0) === 0 && fallbackWord) {
      const candidates = await this.searchWordCandidates(fallbackWord);
      for (const candidate of candidates) {
        if (candidate.wordId === resolvedRootWordId) {
          continue;
        }

        const candidateResponse = await this.fetchTraversal('ancestors', candidate.wordId, depth);
        if ((candidateResponse.edges?.length ?? 0) > 0) {
          resolvedRootWordId = candidate.wordId;
          response = candidateResponse;
          break;
        }
      }
    }

    const wordIds = collectWordIds(resolvedRootWordId, response.edges);

    const labels = await Promise.all(
      wordIds.map(async (id) => [id, await fetchWordLabel(id)] as const)
    );

    return buildFlowGraph(resolvedRootWordId, response.edges, new Map(labels), 'ancestors');
  }
}

export const graphService = new GraphService();
