const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export interface SearchResult {
  wordId: string;
  textOriginal: string;
  language: string;
}

interface SearchResponse {
  results?: SearchResult[];
}

export async function searchWords(query: string): Promise<SearchResult[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const response = await fetch(`${API_BASE}/v1/search?q=${encodeURIComponent(trimmedQuery)}`);
  if (!response.ok) {
    throw new Error(`Failed to search words (${response.status})`);
  }

  const payload = (await response.json()) as SearchResponse;
  return payload.results ?? [];
}