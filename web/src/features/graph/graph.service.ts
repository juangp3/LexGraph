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
  /** Phase 5 API field */
  id: string;
  text: string;
  language: string | null;
  // legacy compat aliases populated by normalizeResult in search.service
  wordId?: string;
  textOriginal?: string;
}

interface SearchResponse {
  results: SearchResult[];
}

interface NodeMetadata {
  label: string;
  language: string;
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

function resolveLanguageFamily(language: string): string {
  const normalized = language.toLowerCase();

  if (/(english|german|french|dutch|swedish|norwegian|danish|icelandic|germanic)/.test(normalized)) {
    return 'germanic';
  }
  if (/(latin|spanish|portuguese|italian|romanian|french|romance)/.test(normalized)) {
    return 'romance';
  }
  if (/(slavic|russian|polish|czech|serbian|croatian|ukrainian|bulgarian)/.test(normalized)) {
    return 'slavic';
  }
  if (/(arabic|hebrew|aramaic|amharic|semitic)/.test(normalized)) {
    return 'semitic';
  }
  if (/(hungarian|finnish|estonian|mari|komi|udmurt|uralic)/.test(normalized)) {
    return 'uralic';
  }

  return 'unknown';
}

async function fetchWordMetadata(wordId: string): Promise<NodeMetadata> {
  try {
    const details = await fetchJson<GraphWordDetailsResponse>(
      `${API_BASE}/v1/words/${encodeURIComponent(wordId)}`
    );
    return {
      label: details.textOriginal || wordId,
      language: details.language || 'Unknown',
    };
  } catch {
    return {
      label: wordId,
      language: 'Unknown',
    };
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
  metadataById: Map<string, NodeMetadata>,
  mode: GraphMode
): FlowGraph {
  const nodeIds = collectWordIds(rootWordId, edges);

  const nodes: Node[] = nodeIds.map((id) => ({
    id,
    data: {
      label: metadataById.get(id)?.label ?? id,
      language: metadataById.get(id)?.language ?? 'Unknown',
      family: resolveLanguageFamily(metadataById.get(id)?.language ?? 'Unknown'),
    },
    position: { x: 0, y: 0 },
    style: {
      borderRadius: 18,
      border: `1px solid var(--graph-family-${resolveLanguageFamily(metadataById.get(id)?.language ?? 'Unknown')})`,
      background:
        id === rootWordId
          ? `color-mix(in srgb, var(--graph-family-${resolveLanguageFamily(metadataById.get(id)?.language ?? 'Unknown')}) 16%, var(--card))`
          : `color-mix(in srgb, var(--graph-family-${resolveLanguageFamily(metadataById.get(id)?.language ?? 'Unknown')}) 11%, var(--card))`,
      color: 'var(--card-foreground)',
      padding: 12,
      fontSize: 12,
      fontWeight: 600,
      width: NODE_WIDTH,
      boxShadow:
        id === rootWordId
          ? '0 20px 40px -28px rgb(0 0 0 / 0.55)'
          : '0 14px 28px -28px rgb(0 0 0 / 0.35)',
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
      stroke: `var(--graph-edge-${mode})`,
      strokeWidth: mode === 'ancestors' ? 2.3 : 1.9,
    },
    labelStyle: {
      fill: 'var(--muted-foreground)',
      fontSize: 11,
      fontWeight: 500,
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

    const metadata = await Promise.all(
      wordIds.map(async (id) => [id, await fetchWordMetadata(id)] as const)
    );

    return buildFlowGraph(rootWordId, response.edges, new Map(metadata), mode);
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
        const candidateId = candidate.id ?? candidate.wordId ?? '';
        if (!candidateId || candidateId === resolvedRootWordId) {
          continue;
        }

        const candidateResponse = await this.fetchTraversal('ancestors', candidateId, depth);
        if ((candidateResponse.edges?.length ?? 0) > 0) {
          resolvedRootWordId = candidateId;
          response = candidateResponse;
          break;
        }
      }
    }

    const wordIds = collectWordIds(resolvedRootWordId, response.edges);

    const metadata = await Promise.all(
      wordIds.map(async (id) => [id, await fetchWordMetadata(id)] as const)
    );

    return buildFlowGraph(resolvedRootWordId, response.edges, new Map(metadata), 'ancestors');
  }
}

export const graphService = new GraphService();
