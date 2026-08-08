export type SearchEntityType = "word" | "language" | "family" | "root";

export type SearchMatchType =
  | "exact"
  | "prefix"
  | "substring"
  | "fuzzy"
  | "meaning"
  | "historical"
  | "root"
  | "language"
  | "family";

export interface SearchMatch {
  type: SearchMatchType;
  score: number;
}

export interface SearchResult {
  /** The entity id (word id or language/family id) */
  id: string;
  /** Entity type */
  type: SearchEntityType;
  /** Display text */
  text: string;
  /** Language name (null for family-type results) */
  language: string | null;
  /** Language family name */
  languageFamily: string | null;
  /** Stage label (e.g. "Proto", "Classical") */
  stage: string | null;
  /** Whether the word is a reconstructed form */
  isReconstructed: boolean;
  /** Match metadata */
  match: SearchMatch;
  // Legacy compat fields used by older components
  wordId: string;
  textOriginal: string;
  textNormalized?: string;
}

export interface SearchFilters {
  language?: string;
  family?: string;
  type?: SearchEntityType;
}

export interface SearchMetadata {
  total: number;
  executionTimeMs: number;
}

export interface SearchResponse {
  query: string;
  filters: {
    language: string | null;
    family: string | null;
    type: string | null;
  };
  results: SearchResult[];
  metadata: SearchMetadata;
}
