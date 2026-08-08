import type { GraphRepository, GraphTraversalEdge } from '../repositories/interfaces.js';

interface GraphQuery {
  rootWordId: string;
  depth?: number;
  include?: ('ancestors' | 'descendants' | 'borrowings' | 'cognates')[];
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
  constructor(private graphRepository: GraphRepository) {}

  async query(query: GraphQuery) {
    const { rootWordId, depth = 4, include = ['ancestors'] } = query;

    const edgeSets = await Promise.all(include.map(async (entry) => {
      switch (entry) {
        case 'ancestors':
          return this.graphRepository.findAncestors(rootWordId, depth);
        case 'descendants':
          return this.graphRepository.findDescendants(rootWordId, depth);
        case 'borrowings':
          return this.graphRepository.findBorrowings(rootWordId, depth);
        case 'cognates':
          return this.graphRepository.findCognates(rootWordId, depth);
        default:
          return [] as GraphTraversalEdge[];
      }
    }));

    const results = edgeSets.flat().reduce<GraphTraversalEdge[]>((acc, edge) => {
      if (!acc.some((existing) => existing.edgeId === edge.edgeId)) {
        acc.push(edge);
      }
      return acc;
    }, []);

    return {
      graph: results,
      metadata: {
        query,
        provenanceEnabled: true,
      },
      viewport: {},
      statistics: {
        edgeCount: results.length,
        disputedEdges: results.filter((edge: GraphTraversalEdge) => edge.isDisputed).length,
        lowConfidenceEdges: results.filter((edge: GraphTraversalEdge) => edge.confidence < 0.8).length,
      },
    };
  }

  async expand(query: GraphExpansionQuery) {
    const { entityId, direction, depth, relationshipTypes, entityTypes, limit = 25, cursor } = query;

    const edges = await this.fetchEdges(entityId, direction, depth, relationshipTypes);
    const filteredEdges = this.filterEdges(edges, relationshipTypes);
    const pagedEdges = this.paginateEdges(filteredEdges, limit, cursor);
    const nodes = this.buildNodes(entityId, pagedEdges.edges);

    return {
      entityId,
      direction,
      depth,
      nodes,
      edges: pagedEdges.edges.map((edge) => ({
        ...edge,
        layer: this.inferLayer(edge.relationType),
        relationshipType: edge.relationType,
      })),
      meta: {
        direction,
        nodeCount: nodes.length,
        edgeCount: pagedEdges.edges.length,
        pagination: {
          limit,
          cursor,
          nextCursor: pagedEdges.hasMore ? `${cursor ?? 'cursor'}-next` : null,
        },
        expansion: {
          direction,
          depth,
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
