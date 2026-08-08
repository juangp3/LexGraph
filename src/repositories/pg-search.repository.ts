import { dbPool } from "../db/client.js";
import type {
  SearchCandidate,
  SearchEntityType,
  SearchFilters,
  SearchMatchType,
  SearchRepository,
} from "./interfaces.js";

const MAX_QUERY_LENGTH = 200;

function normalizeSearchInput(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function classifyMatchType(
  textNormalized: string,
  textAsciiFolded: string,
  normalizedQuery: string,
  isReconstructed: boolean,
): SearchMatchType {
  if (isReconstructed) return "root";
  if (textNormalized === normalizedQuery || textAsciiFolded === normalizedQuery) return "exact";
  if (textNormalized.startsWith(normalizedQuery) || textAsciiFolded.startsWith(normalizedQuery)) return "prefix";
  if (textNormalized.includes(normalizedQuery) || textAsciiFolded.includes(normalizedQuery)) return "substring";
  return "fuzzy";
}

interface WordSearchRow {
  id: string;
  text_original: string;
  text_normalized: string;
  text_ascii_folded: string;
  language_name: string;
  language_family_name: string | null;
  stage_label: string | null;
  is_reconstructed: boolean;
  score: string;
}

interface LangSearchRow {
  id: string;
  name: string;
  stage_label: string | null;
  family_name: string | null;
  score: string;
}

interface FamilySearchRow {
  id: string;
  name: string;
  score: string;
}

export class PgSearchRepository implements SearchRepository {
  async searchCandidates(
    query: string,
    filters: SearchFilters = {},
    limit: number = 10
  ): Promise<SearchCandidate[]> {
    const truncated = query.slice(0, MAX_QUERY_LENGTH);
    const normalized = normalizeSearchInput(truncated);
    const safeLimit = Math.max(1, Math.min(limit, 50));

    if (!normalized) return [];

    const entityType = filters.type;

    const runWords = !entityType || entityType === "word" || entityType === "root";
    const runLanguages = !entityType || entityType === "language";
    const runFamilies = !entityType || entityType === "family";

    const [wordResults, langResults, familyResults] = await Promise.all([
      runWords ? this.searchWords(normalized, filters, safeLimit) : Promise.resolve([]),
      runLanguages ? this.searchLanguages(normalized, filters, safeLimit) : Promise.resolve([]),
      runFamilies ? this.searchFamilies(normalized, safeLimit) : Promise.resolve([]),
    ]);

    return [...wordResults, ...langResults, ...familyResults];
  }

  private async searchWords(
    normalized: string,
    filters: SearchFilters,
    limit: number
  ): Promise<SearchCandidate[]> {
    const hasLanguageFilter = Boolean(filters.language?.trim());
    const hasFamilyFilter = Boolean(filters.family?.trim());
    const rootsOnly = filters.type === "root";

    const extraConditions: string[] = [];
    const extraParams: unknown[] = [];
    let paramIndex = 2;

    if (hasLanguageFilter) {
      paramIndex++;
      extraConditions.push(`lower(l.name) = lower($${paramIndex})`);
      extraParams.push(filters.language!.trim());
    }

    if (hasFamilyFilter) {
      paramIndex++;
      extraConditions.push(`lower(lf.name) = lower($${paramIndex})`);
      extraParams.push(filters.family!.trim());
    }

    if (rootsOnly) {
      extraConditions.push(`w.is_reconstructed = true`);
    }

    const whereExtra = extraConditions.length > 0 ? `AND ${extraConditions.join(" AND ")}` : "";

    const sql = `
      SELECT
        w.id,
        w.text_original,
        w.text_normalized,
        w.text_ascii_folded,
        l.name AS language_name,
        lf.name AS language_family_name,
        l.stage_label,
        w.is_reconstructed,
        GREATEST(
          similarity(w.text_normalized, $1),
          similarity(w.text_ascii_folded, $1),
          similarity(unaccent(lower(w.text_original)), $1)
        ) AS score
      FROM words w
      JOIN languages l ON l.id = w.language_id
      LEFT JOIN language_families lf ON lf.id = l.family_id
      WHERE (
        w.text_normalized % $1
        OR w.text_ascii_folded % $1
        OR unaccent(lower(w.text_original)) LIKE ('%' || $1 || '%')
        OR w.text_normalized LIKE ($1 || '%')
        OR w.text_ascii_folded LIKE ($1 || '%')
      )
      ${whereExtra}
      ORDER BY
        (w.text_normalized = $1 OR w.text_ascii_folded = $1 OR unaccent(lower(w.text_original)) = $1) DESC,
        (w.text_normalized LIKE ($1 || '%') OR w.text_ascii_folded LIKE ($1 || '%')) DESC,
        GREATEST(
          similarity(w.text_normalized, $1),
          similarity(w.text_ascii_folded, $1),
          similarity(unaccent(lower(w.text_original)), $1)
        ) DESC,
        char_length(w.text_original) ASC
      LIMIT $2
    `;

    const params: unknown[] = [normalized, limit, ...extraParams];
    const result = await dbPool.query<WordSearchRow>(sql, params);

    return result.rows.map((row) => {
      const matchType = classifyMatchType(
        row.text_normalized,
        row.text_ascii_folded,
        normalized,
        row.is_reconstructed
      );
      const entityType: SearchEntityType = row.is_reconstructed ? "root" : "word";

      return {
        wordId: row.id,
        textOriginal: row.text_original,
        textNormalized: row.text_normalized,
        language: row.language_name,
        languageFamily: row.language_family_name,
        stage: row.stage_label,
        score: Number(row.score),
        type: entityType,
        matchType,
        isReconstructed: row.is_reconstructed,
      };
    });
  }

  private async searchLanguages(
    normalized: string,
    filters: SearchFilters,
    limit: number
  ): Promise<SearchCandidate[]> {
    const hasFamilyFilter = Boolean(filters.family?.trim());
    const familyCondition = hasFamilyFilter ? `AND lower(lf.name) = lower($3)` : "";
    const params: unknown[] = [normalized, limit];
    if (hasFamilyFilter) params.push(filters.family!.trim());

    const sql = `
      SELECT
        l.id,
        l.name,
        l.stage_label,
        lf.name AS family_name,
        similarity(lower(l.name), $1) AS score
      FROM languages l
      LEFT JOIN language_families lf ON lf.id = l.family_id
      WHERE lower(l.name) % $1 OR lower(l.name) LIKE ($1 || '%')
      ${familyCondition}
      ORDER BY
        (lower(l.name) = $1) DESC,
        similarity(lower(l.name), $1) DESC
      LIMIT $2
    `;

    const result = await dbPool.query<LangSearchRow>(sql, params);

    return result.rows.map((row) => ({
      wordId: row.id,
      textOriginal: row.name,
      textNormalized: row.name.toLowerCase(),
      language: row.name,
      languageFamily: row.family_name,
      stage: row.stage_label,
      score: Number(row.score),
      type: "language" as SearchEntityType,
      matchType: (row.name.toLowerCase() === normalized ? "exact" : "prefix") as SearchMatchType,
      isReconstructed: false,
    }));
  }

  private async searchFamilies(normalized: string, limit: number): Promise<SearchCandidate[]> {
    const sql = `
      SELECT
        id,
        name,
        similarity(lower(name), $1) AS score
      FROM language_families
      WHERE lower(name) % $1 OR lower(name) LIKE ($1 || '%')
      ORDER BY
        (lower(name) = $1) DESC,
        similarity(lower(name), $1) DESC
      LIMIT $2
    `;

    const result = await dbPool.query<FamilySearchRow>(sql, [normalized, limit]);

    return result.rows.map((row) => ({
      wordId: row.id,
      textOriginal: row.name,
      textNormalized: row.name.toLowerCase(),
      language: "",
      languageFamily: row.name,
      stage: null,
      score: Number(row.score),
      type: "family" as SearchEntityType,
      matchType: (row.name.toLowerCase() === normalized ? "exact" : "prefix") as SearchMatchType,
      isReconstructed: false,
    }));
  }

  async rankCandidates(candidates: SearchCandidate[], query: string): Promise<SearchCandidate[]> {
    const normalized = normalizeSearchInput(query);

    const matchPriority: Record<SearchMatchType, number> = {
      exact: 0,
      prefix: 1,
      root: 2,
      historical: 3,
      substring: 4,
      meaning: 5,
      fuzzy: 6,
      language: 7,
      family: 8,
    };

    return [...candidates].sort((a, b) => {
      const pa = matchPriority[a.matchType] ?? 9;
      const pb = matchPriority[b.matchType] ?? 9;

      if (pa !== pb) return pa - pb;
      if (a.score !== b.score) return b.score - a.score;

      const aExact = a.textNormalized === normalized ? 0 : 1;
      const bExact = b.textNormalized === normalized ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;

      return a.textOriginal.localeCompare(b.textOriginal);
    });
  }
}
