import { dbPool } from "../db/client.js";
import type {
  WordDetailMeaning,
  WordDetails,
  WordDetailsRepository,
  WordDetailSource,
  WordDetailRelationshipEdge,
  WordDetailEtymology
} from "./interfaces.js";

interface WordDetailRow {
  word_id: string;
  text_original: string;
  text_normalized: string;
  language_name: string;
  stage_label: string | null;
  language_family_name: string | null;
  pronunciation: string | null;
  period_label: string | null;
  is_reconstructed: boolean | null;
  meanings: WordDetailMeaning[] | null;
  sources: WordDetailSource[] | null;
}

interface EtymologyEdgeRow {
  relation_type: string;
  target_word: string;
  target_language: string | null;
  target_stage: string | null;
  confidence: string | number | null;
}

function formatConfidence(value: number | null): { label: string; value: number | null } {
  if (value === null || value === undefined) {
    return { label: "Medium confidence", value: null };
  }

  if (value >= 0.9) {
    return { label: "High confidence", value };
  }

  if (value >= 0.7) {
    return { label: "Medium confidence", value };
  }

  return { label: "Low confidence", value };
}

export class PgWordDetailsRepository implements WordDetailsRepository {
  async getWordDetails(wordId: string): Promise<WordDetails | null> {
    const result = await dbPool.query<WordDetailRow>(
      `
      SELECT
        w.id AS word_id,
        w.text_original,
        w.text_normalized,
        l.name AS language_name,
        l.stage_label,
        lf.name AS language_family_name,
        w.ipa AS pronunciation,
        w.period_label,
        w.is_reconstructed,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'gloss', m.gloss,
              'domain', m.domain,
              'usageNote', m.usage_note
            )
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'::json
        ) AS meanings,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'sourceId', s.id,
              'title', s.title,
              'author', s.author,
              'year', s.year,
              'sourceLocator', ws.source_locator,
              'confidence', ws.confidence
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) AS sources
      FROM words w
      JOIN languages l ON l.id = w.language_id
      LEFT JOIN language_families lf ON lf.id = l.family_id
      LEFT JOIN meanings m ON m.word_id = w.id
      LEFT JOIN word_sources ws ON ws.word_id = w.id
      LEFT JOIN sources s ON s.id = ws.source_id
      WHERE w.id = $1
      GROUP BY w.id, l.name, l.stage_label, lf.name, w.ipa, w.period_label, w.is_reconstructed
      `,
      [wordId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const etymologyResult = await dbPool.query<EtymologyEdgeRow>(
      `
      SELECT
        ee.relation_type,
        tw.text_original AS target_word,
        tl.name AS target_language,
        tl.stage_label AS target_stage,
        ee.confidence
      FROM etymology_edges ee
      JOIN words tw ON tw.id = ee.to_word_id
      LEFT JOIN languages tl ON tl.id = tw.language_id
      WHERE ee.from_word_id = $1
      ORDER BY
        CASE ee.relation_type
          WHEN 'EVOLVED_FROM' THEN 1
          WHEN 'BORROWED_FROM' THEN 2
          WHEN 'COGNATE_WITH' THEN 3
          ELSE 4
        END,
        tw.text_original
      `,
      [wordId]
    );

    const edges = etymologyResult.rows.map((edge) => ({
      relationType: edge.relation_type,
      targetWord: edge.target_word,
      targetLanguage: edge.target_language,
      targetStage: edge.target_stage,
      confidence: edge.confidence === null || edge.confidence === undefined ? null : Number(edge.confidence)
    })) as WordDetailRelationshipEdge[];

    const etymology: WordDetailEtymology = {
      ancestors: edges.filter((edge) => edge.relationType === "EVOLVED_FROM"),
      descendants: [],
      cognates: edges.filter((edge) => edge.relationType === "COGNATE_WITH"),
      borrowings: edges.filter((edge) => edge.relationType === "BORROWED_FROM")
    };

    const sources = (row.sources ?? []).map((source) => ({
      ...source,
      confidence: Number(source.confidence)
    }));

    const highestConfidence = sources.reduce<number | null>((best, source) => {
      if (source.confidence === null || source.confidence === undefined) {
        return best;
      }
      return best === null ? source.confidence : Math.max(best, source.confidence);
    }, null);

    return {
      wordId: row.word_id,
      textOriginal: row.text_original,
      textNormalized: row.text_normalized,
      language: row.language_name,
      stage: row.stage_label,
      meanings: row.meanings ?? [],
      sources,
      languageFamily: row.language_family_name,
      pronunciation: row.pronunciation,
      periodLabel: row.period_label,
      isReconstructed: row.is_reconstructed ?? false,
      etymology,
      relationships: {
        ancestors: etymology.ancestors.length,
        descendants: etymology.descendants.length,
        cognates: etymology.cognates.length,
        borrowings: etymology.borrowings.length
      },
      confidence: formatConfidence(highestConfidence),
      ancestry: etymology.ancestors.length > 0
        ? etymology.ancestors.map((item) => ({
            stage: item.targetWord,
            language: item.targetLanguage ?? "Unknown"
          }))
        : [{ stage: row.text_original, language: row.language_name }]
    };
  }
}
