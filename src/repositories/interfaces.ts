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
  evidenceSummary?: string;
  isDisputed?: boolean;
  createdBy?: string;
  sources?: Array<{
    sourceId: string;
    sourceLocator?: string;
    quoteExcerpt?: string;
    confidenceDelta?: number;
  }>;
}

export interface GraphEdgeSourceRef {
  sourceId: string;
  sourceLocator: string | null;
  quoteExcerpt: string | null;
  confidenceDelta: number | null;
}

export interface GraphTraversalEdge {
  edgeId: string;
  fromWordId: string;
  toWordId: string;
  relationType: "EVOLVED_FROM" | "BORROWED_FROM" | "COGNATE_WITH";
  confidence: number;
  method: "manual" | "imported" | "inferred";
  isDisputed: boolean;
  evidenceSummary: string | null;
  depth: number;
  path: string[];
  sources: GraphEdgeSourceRef[];
}

export interface GraphRepository {
  upsertEdge(input: GraphEdgeInput): Promise<void>;
  findAncestors(wordId: string, depth: number): Promise<GraphTraversalEdge[]>;
  findDescendants(wordId: string, depth: number): Promise<GraphTraversalEdge[]>;
  findBorrowings(wordId: string, depth: number): Promise<GraphTraversalEdge[]>;
  findCognates(wordId: string, depth: number): Promise<GraphTraversalEdge[]>;
}

export interface SearchCandidate {
  wordId: string;
  score: number;
}

export interface SearchRepository {
  searchCandidates(query: string, languageFilter?: string, limit?: number): Promise<SearchCandidate[]>;
  rankCandidates(candidates: SearchCandidate[], query: string): Promise<SearchCandidate[]>;
}
