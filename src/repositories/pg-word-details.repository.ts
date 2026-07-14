import { dbPool } from "../db/client.js";
import type {
  WordDetailMeaning,
  WordDetails,
  WordDetailsRepository,
  WordDetailSource
} from "./interfaces.js";

interface WordDetailRow {
  word_id: string;
  text_original: string;
  text_normalized: string;
  language_name: string;
  stage_label: string | null;
  meanings: WordDetailMeaning[] | null;
  sources: WordDetailSource[] | null;
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
      LEFT JOIN meanings m ON m.word_id = w.id
      LEFT JOIN word_sources ws ON ws.word_id = w.id
      LEFT JOIN sources s ON s.id = ws.source_id
      WHERE w.id = $1
      GROUP BY w.id, l.name, l.stage_label
      `,
      [wordId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      wordId: row.word_id,
      textOriginal: row.text_original,
      textNormalized: row.text_normalized,
      language: row.language_name,
      stage: row.stage_label,
      meanings: row.meanings ?? [],
      sources: (row.sources ?? []).map((source) => ({
        ...source,
        confidence: Number(source.confidence)
      }))
    };
  }
}
