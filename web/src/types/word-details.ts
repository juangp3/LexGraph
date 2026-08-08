export interface WordDetails {
  word: string;
  language: string;
  meaning: string;
  sources: string[];
  timeline: string;
  ancestry: {
    stage: string;
    language: string;
  }[];
  languageFamily?: string | null;
  pronunciation?: string | null;
  periodLabel?: string | null;
  isReconstructed?: boolean;
  relationshipSummary?: {
    ancestors: number;
    descendants: number;
    cognates: number;
    borrowings: number;
  };
  etymology?: {
    ancestors: Array<{
      relationType: string;
      targetWord: string;
      targetLanguage: string | null;
      targetStage: string | null;
      confidence: number | null;
    }>;
    descendants: Array<{
      relationType: string;
      targetWord: string;
      targetLanguage: string | null;
      targetStage: string | null;
      confidence: number | null;
    }>;
    cognates: Array<{
      relationType: string;
      targetWord: string;
      targetLanguage: string | null;
      targetStage: string | null;
      confidence: number | null;
    }>;
    borrowings: Array<{
      relationType: string;
      targetWord: string;
      targetLanguage: string | null;
      targetStage: string | null;
      confidence: number | null;
    }>;
  };
  confidence?: {
    label: string;
    value: number | null;
  };
}
