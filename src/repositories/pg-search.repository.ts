import { dbPool } from "../db/client.js";
import type { SearchCandidate, SearchRepository } from "./interfaces.js";

function normalizeSearchInput(input: string): string {
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

interface SearchRow {
  word_id: string;
  text_original: string;
  text_normalized: string;
  language_name: string;
  stage_label: string | null;
  score: string;
  exact_match: boolean;
}

export class PgSearchRepository implements SearchRepository {
  async searchCandidates(query: string, languageFilter?: string, limit: number = 10): Promise<SearchCandidate[]> {
    const normalized = normalizeSearchInput(query);
    const safeLimit = Math.max(1, Math.min(limit, 25));

    if (!normalized) {
      return [];
    }

    const hasLanguageFilter = Boolean(languageFilter && languageFilter.trim());

    const sql = `
      SELECT
        w.id AS word_id,
        w.text_original,
        w.text_normalized,
        l.name AS language_name,
        l.stage_label,
        GREATEST(
          similarity(w.text_normalized, $1),
          similarity(w.text_ascii_folded, $1),
          similarity(unaccent(lower(w.text_original)), $1)
        ) AS score,
        (w.text_normalized = $1 OR w.text_ascii_folded = $1 OR unaccent(lower(w.text_original)) = $1) AS exact_match
      FROM words w
      JOIN languages l ON l.id = w.language_id
      WHERE (
        w.text_normalized % $1
        OR w.text_ascii_folded % $1
        OR unaccent(lower(w.text_original)) LIKE ('%' || $1 || '%')
      )
      ${hasLanguageFilter ? "AND lower(l.name) = lower($3)" : ""}
      ORDER BY exact_match DESC, score DESC, char_length(w.text_original) ASC
      LIMIT $2
    `;

    const params = hasLanguageFilter
      ? [normalized, safeLimit, languageFilter?.trim()]
      : [normalized, safeLimit];

    const result = await dbPool.query<SearchRow>(sql, params);

    return result.rows.map((row) => ({
      wordId: row.word_id,
      textOriginal: row.text_original,
      textNormalized: row.text_normalized,
      language: row.language_name,
      stage: row.stage_label,
      score: Number(row.score)
    }));
  }

  async rankCandidates(candidates: SearchCandidate[], query: string): Promise<SearchCandidate[]> {
    const normalized = normalizeSearchInput(query);

    return [...candidates].sort((a, b) => {
      const aExact = a.textNormalized === normalized ? 1 : 0;
      const bExact = b.textNormalized === normalized ? 1 : 0;

      if (aExact !== bExact) {
        return bExact - aExact;
      }

      if (a.score !== b.score) {
        return b.score - a.score;
      }

      return a.textOriginal.localeCompare(b.textOriginal);
    });
  }
}
