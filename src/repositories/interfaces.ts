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
  conflictType?: string | null;
  conflictDetails?: string | null;
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
  conflictType?: string | null;
  conflictDetails?: string | null;
  depth: number;
  path: string[];
  sources: GraphEdgeSourceRef[];
}

export interface GraphRelationship extends GraphTraversalEdge {
  direction: "incoming" | "outgoing";
}

export interface GraphRepository {
  upsertEdge(input: GraphEdgeInput): Promise<void>;
  findAncestors(wordId: string, depth: number): Promise<GraphTraversalEdge[]>;
  findDescendants(wordId: string, depth: number): Promise<GraphTraversalEdge[]>;
  findBorrowings(wordId: string, depth: number): Promise<GraphTraversalEdge[]>;
  findCognates(wordId: string, depth: number): Promise<GraphTraversalEdge[]>;
  findRelationships(wordId: string, options?: { limit?: number; cursor?: string }): Promise<GraphRelationship[]>;
}

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

export interface SearchCandidate {
  wordId: string;
  textOriginal: string;
  textNormalized: string;
  language: string;
  languageFamily: string | null;
  stage: string | null;
  score: number;
  type: SearchEntityType;
  matchType: SearchMatchType;
  isReconstructed: boolean;
}

export interface SearchFilters {
  language?: string;
  family?: string;
  type?: SearchEntityType;
}

export interface SearchRepository {
  searchCandidates(query: string, filters?: SearchFilters, limit?: number): Promise<SearchCandidate[]>;
  rankCandidates(candidates: SearchCandidate[], query: string): Promise<SearchCandidate[]>;
}

export interface WordDetailMeaning {
  gloss: string;
  domain: string | null;
  usageNote: string | null;
}

export interface WordDetailSource {
  sourceId: string;
  title: string;
  author: string | null;
  year: number | null;
  sourceLocator: string | null;
  confidence: number;
}

export interface WordDetailRelationshipEdge {
  relationType: string;
  targetWord: string;
  targetLanguage: string | null;
  targetStage: string | null;
  confidence: number | null;
}

export interface WordDetailEtymology {
  ancestors: WordDetailRelationshipEdge[];
  descendants: WordDetailRelationshipEdge[];
  cognates: WordDetailRelationshipEdge[];
  borrowings: WordDetailRelationshipEdge[];
}

export interface WordDetailRelationshipsSummary {
  ancestors: number;
  descendants: number;
  cognates: number;
  borrowings: number;
}

export interface WordDetailConfidence {
  label: string;
  value: number | null;
}

export interface WordDetails {
  wordId: string;
  textOriginal: string;
  textNormalized: string;
  language: string;
  stage: string | null;
  meanings: WordDetailMeaning[];
  sources: WordDetailSource[];
  languageFamily?: string | null;
  pronunciation?: string | null;
  periodLabel?: string | null;
  isReconstructed?: boolean;
  etymology?: WordDetailEtymology;
  relationships?: WordDetailRelationshipsSummary;
  confidence?: WordDetailConfidence;
  ancestry?: Array<{ stage: string; language: string }>;
}

export interface WordDetailsRepository {
  getWordDetails(wordId: string): Promise<WordDetails | null>;
}
