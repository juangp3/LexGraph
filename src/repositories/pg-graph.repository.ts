import { dbPool } from "../db/client.js";
import type {
  GraphEdgeInput,
  GraphEdgeSourceRef,
  GraphRepository,
  GraphTraversalEdge
} from "./interfaces.js";

type RelationType = "EVOLVED_FROM" | "BORROWED_FROM" | "COGNATE_WITH";

type TraversalDirection = "ancestors" | "descendants";

interface GraphQueryRow {
  edge_id: string;
  from_word_id: string;
  to_word_id: string;
  relation_type: RelationType;
  confidence: string;
  method: "manual" | "imported" | "inferred";
  is_disputed: boolean;
  evidence_summary: string | null;
  conflict_type: string | null;
  conflict_details: string | null;
  depth: number;
  path: string[];
  sources: GraphEdgeSourceRef[] | null;
}

export class PgGraphRepository implements GraphRepository {
  async upsertEdge(input: GraphEdgeInput): Promise<void> {
    const client = await dbPool.connect();

    try {
      await client.query("BEGIN");

      const edgeResult = await client.query<{ id: string }>(
        `
        INSERT INTO etymology_edges (
          from_word_id,
          to_word_id,
          relation_type,
          confidence,
          evidence_summary,
          method,
          is_disputed,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (from_word_id, to_word_id, relation_type)
        DO UPDATE SET
          confidence = EXCLUDED.confidence,
          evidence_summary = EXCLUDED.evidence_summary,
          method = EXCLUDED.method,
          is_disputed = EXCLUDED.is_disputed,
          created_by = EXCLUDED.created_by,
          updated_at = now()
        RETURNING id
        `,
        [
          input.fromWordId,
          input.toWordId,
          input.relationType,
          input.confidence,
          input.evidenceSummary ?? null,
          input.method,
          input.isDisputed ?? false,
          input.createdBy ?? null
        ]
      );

      const edgeId = edgeResult.rows[0].id;

      if (input.sources && input.sources.length > 0) {
        for (const source of input.sources) {
          await client.query(
            `
            INSERT INTO edge_sources (edge_id, source_id, source_locator, quote_excerpt, confidence_delta)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
            `,
            [
              edgeId,
              source.sourceId,
              source.sourceLocator ?? null,
              source.quoteExcerpt ?? null,
              source.confidenceDelta ?? null
            ]
          );

          await client.query(
            `
            UPDATE edge_sources
            SET quote_excerpt = $1,
                confidence_delta = $2
            WHERE edge_id = $3
              AND source_id = $4
              AND COALESCE(source_locator, '') = COALESCE($5, '')
            `,
            [
              source.quoteExcerpt ?? null,
              source.confidenceDelta ?? null,
              edgeId,
              source.sourceId,
              source.sourceLocator ?? null
            ]
          );
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findAncestors(wordId: string, depth: number): Promise<GraphTraversalEdge[]> {
    return this.privateTraverse(wordId, depth, "ancestors");
  }

  async findDescendants(wordId: string, depth: number): Promise<GraphTraversalEdge[]> {
    return this.privateTraverse(wordId, depth, "descendants");
  }

  async findBorrowings(wordId: string, depth: number): Promise<GraphTraversalEdge[]> {
    return this.privateTraverse(wordId, depth, "ancestors", "BORROWED_FROM");
  }

  async findCognates(wordId: string, depth: number): Promise<GraphTraversalEdge[]> {
    return this.privateTraverse(wordId, depth, "ancestors", "COGNATE_WITH");
  }

  async traverse(
    query: {
      rootWordId: string;
      depth: number;
      include: ('ancestors' | 'descendants' | 'borrowings' | 'cognates')[];
    }
  ): Promise<GraphTraversalEdge[]> {
    const { rootWordId, depth, include } = query;
    const allEdges: GraphTraversalEdge[] = [];
    const seenEdges = new Set<string>();

    const tasks = include.map(type => {
      switch (type) {
        case 'ancestors':
          return this.privateTraverse(rootWordId, depth, 'ancestors');
        case 'descendants':
          return this.privateTraverse(rootWordId, depth, 'descendants');
        case 'borrowings':
          return this.privateTraverse(rootWordId, depth, 'ancestors', 'BORROWED_FROM');
        case 'cognates':
          return this.privateTraverse(rootWordId, depth, 'ancestors', 'COGNATE_WITH');
        default:
          return Promise.resolve([]);
      }
    });

    const results = await Promise.all(tasks);
    for (const resultSet of results) {
      for (const edge of resultSet) {
        if (!seenEdges.has(edge.edgeId)) {
          allEdges.push(edge);
          seenEdges.add(edge.edgeId);
        }
      }
    }

    return allEdges;
  }

  private async privateTraverse(
    wordId: string,
    depth: number,
    direction: TraversalDirection,
    relationType?: RelationType
  ): Promise<GraphTraversalEdge[]> {
    const safeDepth = Math.max(1, Math.min(depth, 10));

    const baseJoin =
      direction === "ancestors"
        ? "e.from_word_id = $1"
        : "e.to_word_id = $1";

    const recursionJoin =
      direction === "ancestors"
        ? "e.from_word_id = walk.to_word_id"
        : "e.to_word_id = walk.from_word_id";

    const nextNodeExpr = direction === "ancestors" ? "e.to_word_id" : "e.from_word_id";

    const relationFilterSql = relationType
      ? " AND e.relation_type = $3 "
      : "";

    const query = `
      WITH RECURSIVE walk AS (
        SELECT
          e.id AS edge_id,
          e.from_word_id,
          e.to_word_id,
          e.relation_type,
          e.confidence,
          e.method,
          e.is_disputed,
          e.evidence_summary,
          e.conflict_type,
          e.conflict_details,
          1 AS depth,
          ARRAY[e.from_word_id::text, e.to_word_id::text] AS path
        FROM etymology_edges e
        WHERE ${baseJoin}
          ${relationFilterSql}

        UNION ALL

        SELECT
          e.id AS edge_id,
          e.from_word_id,
          e.to_word_id,
          e.relation_type,
          e.confidence,
          e.method,
          e.is_disputed,
          e.evidence_summary,
          e.conflict_type,
          e.conflict_details,
          walk.depth + 1 AS depth,
          walk.path || ${nextNodeExpr}::text AS path
        FROM etymology_edges e
        JOIN walk ON ${recursionJoin}
        WHERE walk.depth < $2
          ${relationFilterSql}
          AND NOT (${nextNodeExpr}::text = ANY(walk.path))
      )
      SELECT
        walk.edge_id,
        walk.from_word_id,
        walk.to_word_id,
        walk.relation_type,
        walk.confidence::text,
        walk.method,
        walk.is_disputed,
        walk.evidence_summary,
        walk.depth,
        walk.path,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'sourceId', es.source_id,
              'sourceLocator', es.source_locator,
              'quoteExcerpt', es.quote_excerpt,
              'confidenceDelta', es.confidence_delta
            )
          ) FILTER (WHERE es.id IS NOT NULL),
          '[]'::json
        ) AS sources
      FROM walk
      LEFT JOIN edge_sources es ON es.edge_id = walk.edge_id
      GROUP BY
        walk.edge_id,
        walk.from_word_id,
        walk.to_word_id,
        walk.relation_type,
        walk.confidence,
        walk.method,
        walk.is_disputed,
        walk.evidence_summary,
        walk.conflict_type,
        walk.conflict_details,
        walk.depth,
        walk.path
      ORDER BY walk.depth ASC, walk.edge_id ASC
    `;

    const params = relationType ? [wordId, safeDepth, relationType] : [wordId, safeDepth];
    const result = await dbPool.query<GraphQueryRow>(query, params);

    return result.rows.map((row) => ({
      edgeId: row.edge_id,
      fromWordId: row.from_word_id,
      toWordId: row.to_word_id,
      relationType: row.relation_type,
      confidence: Number(row.confidence),
      method: row.method,
      isDisputed: row.is_disputed,
      evidenceSummary: row.evidence_summary,
      conflictType: row.conflict_type,
      conflictDetails: row.conflict_details,
      depth: row.depth,
      path: row.path,
      sources: (row.sources ?? []) as GraphEdgeSourceRef[]
    }));
  }
}
