import dagre from 'dagre';
import type { Edge, Node } from 'reactflow';
import {
  GraphTraversalEdge,
  GraphTraversalResponse,
  GraphWordDetailsResponse,
} from '@/types/graph';

export type GraphMode = 'ancestors' | 'descendants' | 'borrowings' | 'cognates';
export type GraphLayout = 'hierarchical' | 'radial' | 'force-directed' | 'grid';

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
const GRAPH_TIMEOUT_MS = 12_000;

const NODE_WIDTH = 220;
const NODE_HEIGHT = 70;

function mergeAbortSignals(signal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

async function fetchJson<T>(url: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  const { signal: mergedSignal, cleanup } = mergeAbortSignals(signal, GRAPH_TIMEOUT_MS);
  const response = await fetch(url, { signal: mergedSignal, credentials: 'include', ...init }).finally(cleanup);
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

async function fetchWordMetadata(wordId: string, signal?: AbortSignal): Promise<NodeMetadata> {
  try {
    const details = await fetchJson<GraphWordDetailsResponse>(
      `${API_BASE}/v1/words/${encodeURIComponent(wordId)}`,
      signal
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

async function fetchWordMetadataBatch(wordIds: string[], signal?: AbortSignal): Promise<Map<string, NodeMetadata>> {
  if (!wordIds.length) {
    return new Map();
  }

  try {
    const response = await fetchJson<{ items: Array<GraphWordDetailsResponse & { id?: string }> }>(
      `${API_BASE}/v1/words/batch`,
      signal,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordIds }),
      }
    );
    const metadata = new Map<string, NodeMetadata>();
    for (const item of response.items ?? []) {
      if (!item?.id) continue;
      metadata.set(item.id, {
        label: item.textOriginal || item.id,
        language: item.language || 'Unknown',
      });
    }

    if (metadata.size === wordIds.length) {
      return metadata;
    }
  } catch {
    // fall through to per-word fallback below
  }

  const fallback = new Map<string, NodeMetadata>();
  await Promise.all(wordIds.map(async (id) => {
    const metadata = await fetchWordMetadata(id, signal);
    fallback.set(id, metadata);
  }));

  return fallback;
}

function collectWordIds(rootWordId: string, edges: GraphTraversalEdge[]): string[] {
  const ids = new Set<string>([rootWordId]);
  edges.forEach((edge) => {
    ids.add(edge.fromWordId);
    ids.add(edge.toWordId);
  });
  return [...ids];
}

function applyHierarchicalLayout(nodes: Node[], edges: Edge[]): Node[] {
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

function applyRadialLayout(nodes: Node[], edges: Edge[], rootWordId: string): Node[] {
  const byId = new Map(nodes.map((node) => [node.id, node] as const));
  const childrenByNode = new Map<string, string[]>();

  for (const edge of edges) {
    const current = childrenByNode.get(edge.source) ?? [];
    current.push(edge.target);
    childrenByNode.set(edge.source, current);
  }

  const depthById = new Map<string, number>();
  const queue: string[] = [];
  if (byId.has(rootWordId)) {
    depthById.set(rootWordId, 0);
    queue.push(rootWordId);
  }

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const currentDepth = depthById.get(current) ?? 0;
    const children = childrenByNode.get(current) ?? [];
    for (const child of children) {
      if (depthById.has(child)) {
        continue;
      }
      depthById.set(child, currentDepth + 1);
      queue.push(child);
    }
  }

  let maxDepth = 0;
  for (const node of nodes) {
    if (!depthById.has(node.id)) {
      maxDepth += 1;
      depthById.set(node.id, maxDepth);
    }
    maxDepth = Math.max(maxDepth, depthById.get(node.id) ?? 0);
  }

  const ringByDepth = new Map<number, Node[]>();
  for (const node of nodes) {
    const depth = depthById.get(node.id) ?? 0;
    const ring = ringByDepth.get(depth) ?? [];
    ring.push(node);
    ringByDepth.set(depth, ring);
  }

  const baseRadius = 180;
  const centerX = 0;
  const centerY = 0;

  return nodes.map((node) => {
    const depth = depthById.get(node.id) ?? 0;
    if (depth === 0) {
      return {
        ...node,
        position: {
          x: centerX - NODE_WIDTH / 2,
          y: centerY - NODE_HEIGHT / 2,
        },
      };
    }

    const ring = ringByDepth.get(depth) ?? [node];
    const index = Math.max(0, ring.findIndex((item) => item.id === node.id));
    const count = Math.max(1, ring.length);
    const angle = count === 1
      ? (-Math.PI / 2) + depth * 0.8
      : (-Math.PI / 2) + ((2 * Math.PI * index) / count);
    const radius = baseRadius * depth;

    return {
      ...node,
      position: {
        x: centerX + Math.cos(angle) * radius - NODE_WIDTH / 2,
        y: centerY + Math.sin(angle) * radius - NODE_HEIGHT / 2,
      },
    };
  });
}

function applyGridLayout(nodes: Node[]): Node[] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const xGap = NODE_WIDTH + 64;
  const yGap = NODE_HEIGHT + 64;

  return nodes.map((node, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    return {
      ...node,
      position: {
        x: col * xGap,
        y: row * yGap,
      },
    };
  });
}

function applyLayout(nodes: Node[], edges: Edge[], rootWordId: string, layout: GraphLayout): Node[] {
  switch (layout) {
    case 'radial':
      return applyRadialLayout(nodes, edges, rootWordId);
    case 'grid':
      return applyGridLayout(nodes);
    case 'force-directed':
      // Temporary fallback until force simulation is implemented.
      return applyRadialLayout(nodes, edges, rootWordId);
    case 'hierarchical':
    default:
      return applyHierarchicalLayout(nodes, edges);
  }
}

function buildFlowGraph(
  rootWordId: string,
  edges: GraphTraversalEdge[],
  metadataById: Map<string, NodeMetadata>,
  mode: GraphMode,
  layout: GraphLayout = 'hierarchical'
): FlowGraph {
  const nodeIds = collectWordIds(rootWordId, edges);

  const nodes: Node[] = nodeIds.map((id) => {
    const nodeMetadata = metadataById.get(id);
    const relatedEdges = edges.filter((edge) => edge.fromWordId === id || edge.toWordId === id);
    const highestConfidence = relatedEdges.reduce((best, edge) => {
      const candidate = edge.confidence ?? edge.provenance?.confidence ?? 0.5;
      return Math.max(best, candidate);
    }, 0.5);
    const evidenceSummary = relatedEdges.find((edge) => edge.evidenceSummary)?.evidenceSummary ?? 'No evidence recorded';
    const isDisputed = relatedEdges.some((edge) => edge.isDisputed || edge.provenance?.isDisputed);
    const sourceCount = relatedEdges.reduce((count, edge) => count + (edge.sources?.length ?? 0), 0);

    return {
      id,
      data: {
        label: nodeMetadata?.label ?? id,
        language: nodeMetadata?.language ?? 'Unknown',
        family: resolveLanguageFamily(nodeMetadata?.language ?? 'Unknown'),
        provenance: {
          confidence: highestConfidence,
          evidenceSummary,
          sourceCount,
          isDisputed,
        },
      },
    position: { x: 0, y: 0 },
      style: {
        borderRadius: 18,
        border: `1px solid var(--graph-family-${resolveLanguageFamily(nodeMetadata?.language ?? 'Unknown')})`,
        background:
          id === rootWordId
            ? `color-mix(in srgb, var(--graph-family-${resolveLanguageFamily(nodeMetadata?.language ?? 'Unknown')}) 16%, var(--card))`
            : `color-mix(in srgb, var(--graph-family-${resolveLanguageFamily(nodeMetadata?.language ?? 'Unknown')}) 11%, var(--card))`,
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
    };
  });

  const flowEdges: Edge[] = edges.map((edge) => ({
    id: edge.edgeId,
    source: edge.fromWordId,
    target: edge.toWordId,
    label: edge.relationType,
    data: {
      relationType: edge.relationType,
      mode,
      provenance: edge.provenance ?? {
        confidence: edge.confidence ?? 0.5,
        evidenceSummary: edge.evidenceSummary ?? 'No evidence recorded',
        sourceCount: edge.sources?.length ?? 0,
        sourceTitles: edge.sources?.map((source) => source.sourceId) ?? [],
        isDisputed: edge.isDisputed ?? false,
      },
    },
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
    nodes: applyLayout(nodes, flowEdges, rootWordId, layout),
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
    // Preserve node positions computed by the selected layout.
    // Re-layout here would overwrite radial/grid layouts and make every mode look hierarchical.
    nodes: [...nodesById.values()],
    edges: [...edgesById.values()],
  };
}

class GraphService {
  private async searchWordCandidates(word: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const response = await fetchJson<SearchResponse>(
      `${API_BASE}/v1/search?q=${encodeURIComponent(word)}&limit=10`,
      signal
    );
    return response.results ?? [];
  }

  async fetchTraversal(
    mode: GraphMode,
    rootWordId: string,
    depth = 6,
    signal?: AbortSignal
  ): Promise<GraphTraversalResponse> {
    return fetchJson<GraphTraversalResponse>(
      `${API_BASE}/v1/graph/${mode}/${encodeURIComponent(rootWordId)}?depth=${depth}`,
      signal
    );
  }

  async fetchAncestors(rootWordId: string, depth = 6, signal?: AbortSignal): Promise<GraphTraversalResponse> {
    return this.fetchTraversal('ancestors', rootWordId, depth, signal);
  }

  async fetchDescendants(rootWordId: string, depth = 4, signal?: AbortSignal): Promise<GraphTraversalResponse> {
    return this.fetchTraversal('descendants', rootWordId, depth, signal);
  }

  async fetchBorrowings(rootWordId: string, depth = 4, signal?: AbortSignal): Promise<GraphTraversalResponse> {
    return this.fetchTraversal('borrowings', rootWordId, depth, signal);
  }

  async fetchCognates(rootWordId: string, depth = 3, signal?: AbortSignal): Promise<GraphTraversalResponse> {
    return this.fetchTraversal('cognates', rootWordId, depth, signal);
  }

  async fetchTraversalFlow(
    mode: GraphMode,
    rootWordId: string,
    depth = 6,
    signal?: AbortSignal,
    layout: GraphLayout = 'hierarchical'
  ): Promise<FlowGraph> {
    const response = await this.fetchTraversal(mode, rootWordId, depth, signal);
    const wordIds = collectWordIds(rootWordId, response.edges);

    const metadata = await fetchWordMetadataBatch(wordIds, signal);

    return buildFlowGraph(rootWordId, response.edges, metadata, mode, layout);
  }

  async fetchAncestorsFlow(
    rootWordId: string,
    depth = 6,
    fallbackWord?: string | null,
    signalOrLayout?: AbortSignal | GraphLayout,
    layout: GraphLayout = 'hierarchical'
  ): Promise<FlowGraph> {
    const resolvedSignal = signalOrLayout instanceof AbortSignal ? signalOrLayout : undefined;
    const resolvedLayout = typeof signalOrLayout === 'string' ? signalOrLayout : layout;

    let resolvedRootWordId = rootWordId;
    let response = await this.fetchTraversal('ancestors', resolvedRootWordId, depth, resolvedSignal);

    if ((response.edges?.length ?? 0) === 0 && fallbackWord) {
      const candidates = await this.searchWordCandidates(fallbackWord, resolvedSignal);
      for (const candidate of candidates) {
        const candidateId = candidate.id ?? candidate.wordId ?? '';
        if (!candidateId || candidateId === resolvedRootWordId) {
          continue;
        }

        const candidateResponse = await this.fetchTraversal('ancestors', candidateId, depth, resolvedSignal);
        if ((candidateResponse.edges?.length ?? 0) > 0) {
          resolvedRootWordId = candidateId;
          response = candidateResponse;
          break;
        }
      }
    }

    const wordIds = collectWordIds(resolvedRootWordId, response.edges);

    const metadata = await fetchWordMetadataBatch(wordIds, resolvedSignal);

    return buildFlowGraph(resolvedRootWordId, response.edges, metadata, 'ancestors', resolvedLayout);
  }
}

export const graphService = new GraphService();
