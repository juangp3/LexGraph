export type RelationType = "EVOLVED_FROM" | "BORROWED_FROM" | "COGNATE_WITH";

export interface RawImportRecord {
  family: string;
  language: string;
  stage: string;
  word: string;
  meaning?: string;
  sourceTitle: string;
  sourceAuthor?: string;
  sourceYear?: number;
  sourceUrl?: string;
  sourceLocator?: string;
  relationType?: string;
  relatedWord?: string;
  relatedLanguage?: string;
  relatedStage?: string;
}

export interface NormalizedImportRecord {
  family: string;
  familySlug: string;
  language: string;
  stage: string;
  wordOriginal: string;
  wordNormalized: string;
  wordAsciiFolded: string;
  meaning: string | null;
  sourceTitle: string;
  sourceAuthor: string | null;
  sourceYear: number | null;
  sourceUrl: string | null;
  sourceLocator: string | null;
  relationType: RelationType | null;
  relatedWordOriginal: string | null;
  relatedWordNormalized: string | null;
  relatedWordAsciiFolded: string | null;
  relatedLanguage: string | null;
  relatedStage: string | null;
}

export interface ImportRejection {
  index: number;
  code: string;
  message: string;
  record: unknown;
}

export interface ImportRunResult {
  processed: number;
  accepted: number;
  rejected: number;
  upsertedWords: number;
  upsertedEdges: number;
  rejectionLogPath: string;
}
