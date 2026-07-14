export interface SourceRef {
  sourceId: string;
  locator?: string;
  confidence?: number;
}

export interface WordRecord {
  id: string;
  languageId: string;
  textOriginal: string;
  textNormalized: string;
  lemma?: string;
}

export interface WordRepository {
  upsertWord(input: Omit<WordRecord, "id">): Promise<WordRecord>;
  findByNormalized(languageId: string, textNormalized: string, lemma?: string): Promise<WordRecord | null>;
  attachSource(wordId: string, source: SourceRef): Promise<void>;
}

export interface GraphEdgeInput {
  fromWordId: string;
  toWordId: string;
  relationType: "EVOLVED_FROM" | "BORROWED_FROM" | "COGNATE_WITH";
  confidence: number;
  method: "manual" | "imported" | "inferred";
}

export interface GraphRepository {
  upsertEdge(input: GraphEdgeInput): Promise<void>;
  findAncestors(wordId: string, depth: number): Promise<string[]>;
  findDescendants(wordId: string, depth: number): Promise<string[]>;
  findBorrowings(wordId: string, depth: number): Promise<string[]>;
  findCognates(wordId: string, depth: number): Promise<string[]>;
}

export interface SearchCandidate {
  wordId: string;
  score: number;
}

export interface SearchRepository {
  searchCandidates(query: string, languageFilter?: string, limit?: number): Promise<SearchCandidate[]>;
  rankCandidates(candidates: SearchCandidate[], query: string): Promise<SearchCandidate[]>;
}
