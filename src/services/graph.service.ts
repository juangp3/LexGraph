import { PgGraphRepository } from '../repositories/pg-graph.repository';

interface GraphQuery {
  rootWordId: string;
  depth?: number;
  include?: ('ancestors' | 'descendants' | 'borrowings' | 'cognates')[];
}

export class GraphService {
  constructor(private graphRepository: PgGraphRepository) {}

  async query(query: GraphQuery) {
    const { rootWordId, depth = 4, include = ['ancestors'] } = query;

    const results = await this.graphRepository.traverse({
      rootWordId,
      depth,
      include,
    });

    return {
      graph: results,
      metadata: {
        query,
        provenanceEnabled: true,
      },
      viewport: {},
      statistics: {
        edgeCount: results.length,
        disputedEdges: results.filter((edge) => edge.isDisputed).length,
        lowConfidenceEdges: results.filter((edge) => edge.confidence < 0.8).length,
      },
    };
  }
}
