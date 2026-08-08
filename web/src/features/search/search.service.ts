import type { SearchFilters, SearchResponse, SearchResult } from "./types/search";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export type { SearchResult } from "./types/search";

function normalizeResult(raw: Omit<SearchResult, "wordId" | "textOriginal"> & { id: string; text: string }): SearchResult {
  return {
    ...raw,
    wordId: raw.id,
    textOriginal: raw.text,
    textNormalized: raw.text.toLowerCase(),
  } as SearchResult;
}

export async function searchWords(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchResult[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const params = new URLSearchParams({ q: trimmedQuery });
  if (filters.language) params.set("language", filters.language);
  if (filters.family) params.set("family", filters.family);
  if (filters.type) params.set("type", filters.type);

  const response = await fetch(`${API_BASE}/v1/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to search words (${response.status})`);
  }

  const payload = (await response.json()) as SearchResponse;
  return (payload.results ?? []).map(normalizeResult);
}