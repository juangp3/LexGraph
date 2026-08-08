import type { GraphRepository, GraphTraversalEdge } from '../repositories/interfaces.js';

interface GraphQuery {
  rootWordId: string;
  depth?: number;
  include?: ('ancestors' | 'descendants' | 'borrowings' | 'cognates')[];
}

interface GraphBudget {
  maxDepth: number;
  maxNodes: number;
  maxEdges: number;
}

interface TruncationMeta {
  truncated: boolean;
  reason: 'NONE' | 'DEPTH_LIMIT' | 'NODE_LIMIT' | 'EDGE_LIMIT';
  totalAvailable?: number;
  returned?: number;
}

interface GraphExpansionQuery {
  entityId: string;
  direction: 'ancestors' | 'descendants' | 'borrowings' | 'cognates' | string;
  depth: number;
  relationshipTypes?: string[];
  entityTypes?: string[];
  limit?: number;
  cursor?: string;
}

export class GraphService {
  private readonly budget: GraphBudget = {
    maxDepth: Number(process.env.GRAPH_MAX_DEPTH ?? 4),
    maxNodes: Number(process.env.GRAPH_MAX_NODES ?? 500),
    maxEdges: Number(process.env.GRAPH_MAX_EDGES ?? 1000),
  };

  constructor(private graphRepository: GraphRepository) {}

  async query(query: GraphQuery) {
    const { rootWordId, include = ['ancestors'] } = query;
    const requestedDepth = query.depth ?? this.budget.maxDepth;
    const safeDepth = Math.max(1, Math.min(Math.floor(requestedDepth), this.budget.maxDepth));
    const depthTruncated = requestedDepth > safeDepth;

    const edgeSets = await Promise.all(include.map(async (entry) => {
      switch (entry) {
        case 'ancestors':
          return this.graphRepository.findAncestors(rootWordId, safeDepth);
        case 'descendants':
          return this.graphRepository.findDescendants(rootWordId, safeDepth);
        case 'borrowings':
          return this.graphRepository.findBorrowings(rootWordId, safeDepth);
        case 'cognates':
          return this.graphRepository.findCognates(rootWordId, safeDepth);
        default:
          return [] as GraphTraversalEdge[];
      }
    }));

    const deduplicatedEdges = edgeSets.flat().reduce<GraphTraversalEdge[]>((acc, edge) => {
      if (!acc.some((existing) => existing.edgeId === edge.edgeId)) {
        acc.push(edge);
      }
      return acc;
    }, []);

    const edgeLimited = deduplicatedEdges.slice(0, this.budget.maxEdges);
    const nodes = this.buildNodes(rootWordId, edgeLimited);
    let finalEdges = edgeLimited;
    let truncation: TruncationMeta = {
      truncated: false,
      reason: 'NONE',
    };

    if (depthTruncated) {
      truncation = {
        truncated: true,
        reason: 'DEPTH_LIMIT',
      };
    }

    if (deduplicatedEdges.length > this.budget.maxEdges) {
      truncation = {
        truncated: true,
        reason: 'EDGE_LIMIT',
        totalAvailable: deduplicatedEdges.length,
        returned: edgeLimited.length,
      };
    }

    if (nodes.length > this.budget.maxNodes) {
      const allowedNodeIds = new Set(nodes.slice(0, this.budget.maxNodes).map((node) => node.id));
      finalEdges = edgeLimited.filter((edge) => allowedNodeIds.has(edge.fromWordId) && allowedNodeIds.has(edge.toWordId));
      truncation = {
        truncated: true,
        reason: 'NODE_LIMIT',
        totalAvailable: nodes.length,
        returned: this.budget.maxNodes,
      };
    }

    return {
      graph: finalEdges,
      nodes: this.buildNodes(rootWordId, finalEdges),
      metadata: {
        query: {
          ...query,
          depth: safeDepth,
        },
        provenanceEnabled: true,
        limits: this.budget,
        truncated: truncation,
      },
      viewport: {},
      statistics: {
        edgeCount: finalEdges.length,
        disputedEdges: finalEdges.filter((edge: GraphTraversalEdge) => edge.isDisputed).length,
        lowConfidenceEdges: finalEdges.filter((edge: GraphTraversalEdge) => edge.confidence < 0.8).length,
      },
    };
  }

  async expand(query: GraphExpansionQuery) {
    const { entityId, direction, relationshipTypes, entityTypes, limit = 25, cursor } = query;
    const safeDepth = Math.max(1, Math.min(Math.floor(query.depth), this.budget.maxDepth));
    const depthTruncated = query.depth > safeDepth;

    const edges = await this.fetchEdges(entityId, direction, safeDepth, relationshipTypes);
    const filteredEdges = this.filterEdges(edges, relationshipTypes);
    const budgetedEdges = filteredEdges.slice(0, this.budget.maxEdges);
    const pagedEdges = this.paginateEdges(budgetedEdges, limit, cursor);
    const nodes = this.buildNodes(entityId, pagedEdges.edges);
    const nodeLimited = nodes.slice(0, this.budget.maxNodes);
    const allowedNodeIds = new Set(nodeLimited.map((node) => node.id));
    const safeEdges = pagedEdges.edges.filter((edge) => allowedNodeIds.has(edge.fromWordId) && allowedNodeIds.has(edge.toWordId));

    let truncation: TruncationMeta = {
      truncated: false,
      reason: 'NONE',
    };

    if (depthTruncated) {
      truncation = { truncated: true, reason: 'DEPTH_LIMIT' };
    }
    if (filteredEdges.length > this.budget.maxEdges) {
      truncation = {
        truncated: true,
        reason: 'EDGE_LIMIT',
        totalAvailable: filteredEdges.length,
        returned: budgetedEdges.length,
      };
    }
    if (nodes.length > this.budget.maxNodes) {
      truncation = {
        truncated: true,
        reason: 'NODE_LIMIT',
        totalAvailable: nodes.length,
        returned: nodeLimited.length,
      };
    }

    return {
      entityId,
      direction,
      depth: safeDepth,
      nodes: nodeLimited,
      edges: safeEdges.map((edge) => ({
        ...edge,
        layer: this.inferLayer(edge.relationType),
        relationshipType: edge.relationType,
      })),
      meta: {
        direction,
        nodeCount: nodeLimited.length,
        edgeCount: safeEdges.length,
        pagination: {
          limit,
          cursor,
          nextCursor: pagedEdges.hasMore ? `${cursor ?? 'cursor'}-next` : null,
        },
        truncated: truncation,
        limits: this.budget,
        expansion: {
          direction,
          depth: safeDepth,
          relationshipTypes: relationshipTypes ?? ['INHERITED_FROM', 'BORROWED_FROM', 'COGNATE_WITH'],
          entityTypes: entityTypes ?? ['word'],
        },
      },
    };
  }

  private async fetchEdges(entityId: string, direction: string, depth: number, relationshipTypes?: string[]): Promise<GraphTraversalEdge[]> {
    const requestedTypes = relationshipTypes?.map((value) => value.toUpperCase()) ?? [];

    if (requestedTypes.includes('COGNATE_WITH')) {
      return this.graphRepository.findCognates(entityId, depth);
    }

    if (requestedTypes.includes('BORROWED_FROM')) {
      return this.graphRepository.findBorrowings(entityId, depth);
    }

    switch (direction) {
      case 'ancestors':
        return this.graphRepository.findAncestors(entityId, depth);
      case 'descendants':
        return this.graphRepository.findDescendants(entityId, depth);
      case 'borrowings':
        return this.graphRepository.findBorrowings(entityId, depth);
      case 'cognates':
        return this.graphRepository.findCognates(entityId, depth);
      case 'related':
        return this.graphRepository.findRelationships(entityId, { limit: depth * 10 });
      default:
        return [];
    }
  }

  private filterEdges(edges: GraphTraversalEdge[], relationshipTypes?: string[]) {
    if (!relationshipTypes || relationshipTypes.length === 0) {
      return edges;
    }

    const requested = new Set(relationshipTypes.map((value) => value.toUpperCase()));
    return edges.filter((edge) => requested.has(edge.relationType));
  }

  private paginateEdges(edges: GraphTraversalEdge[], limit: number, cursor?: string) {
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100));
    const startIndex = cursor ? 1 : 0;
    const page = edges.slice(startIndex, startIndex + safeLimit);
    const hasMore = startIndex + page.length < edges.length;

    return { edges: page, hasMore };
  }

  private inferLayer(relationType: string): 'etymology' | 'morphology' | 'language' | 'semantics' {
    switch (relationType) {
      case 'EVOLVED_FROM':
      case 'BORROWED_FROM':
      case 'COGNATE_WITH':
        return 'etymology';
      case 'DERIVED_FROM':
      case 'VARIANT_OF':
        return 'morphology';
      default:
        return 'language';
    }
  }

  private buildNodes(entityId: string, edges: GraphTraversalEdge[]) {
    const nodes = new Map<string, { id: string }>;
    nodes.set(entityId, { id: entityId });

    for (const edge of edges) {
      nodes.set(edge.fromWordId, { id: edge.fromWordId });
      nodes.set(edge.toWordId, { id: edge.toWordId });
    }

    return Array.from(nodes.values());
  }
}
