import { WordDetails } from '@/types/word-details';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

interface BackendWordDetailsResponse {
  wordId?: string;
  textOriginal?: string;
  language?: string;
  stage?: string | null;
  meanings?: Array<{ gloss?: string | null }>;
  sources?: Array<{ title?: string | null; sourceLocator?: string | null }>;
  languageFamily?: string | null;
  pronunciation?: string | null;
  periodLabel?: string | null;
  isReconstructed?: boolean;
  etymology?: {
    ancestors?: Array<{ relationType?: string; targetWord?: string | null; targetLanguage?: string | null; targetStage?: string | null; confidence?: number | null }>;
    descendants?: Array<{ relationType?: string; targetWord?: string | null; targetLanguage?: string | null; targetStage?: string | null; confidence?: number | null }>;
    cognates?: Array<{ relationType?: string; targetWord?: string | null; targetLanguage?: string | null; targetStage?: string | null; confidence?: number | null }>;
    borrowings?: Array<{ relationType?: string; targetWord?: string | null; targetLanguage?: string | null; targetStage?: string | null; confidence?: number | null }>;
  };
  relationships?: {
    ancestors?: number;
    descendants?: number;
    cognates?: number;
    borrowings?: number;
  };
  confidence?: {
    label?: string;
    value?: number | null;
  };
}

function normalizeEtymologyEdge(edge: {
  relationType?: string;
  targetWord?: string | null;
  targetLanguage?: string | null;
  targetStage?: string | null;
  confidence?: number | null;
}) {
  return {
    relationType: edge.relationType ?? 'UNKNOWN',
    targetWord: edge.targetWord ?? 'Unknown',
    targetLanguage: edge.targetLanguage ?? null,
    targetStage: edge.targetStage ?? null,
    confidence: edge.confidence ?? null,
  };
}

class InspectorService {
  async getWordDetails(word: string): Promise<WordDetails> {
    const response = await fetch(`${API_BASE}/v1/words/${encodeURIComponent(word)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch word metadata (${response.status})`);
    }

    const payload = (await response.json()) as BackendWordDetailsResponse;
    const ancestry = (payload.etymology?.ancestors ?? []).map((item) => ({
      stage: item.targetWord ?? 'Unknown',
      language: item.targetLanguage ?? 'Unknown',
    }));

    return {
      word: payload.textOriginal ?? word,
      language: payload.language ?? 'Unknown',
      meaning: payload.meanings?.[0]?.gloss ?? 'Meaning unavailable for this node.',
      sources:
        payload.sources?.map((source) =>
          source.title
            ? source.title
            : source.sourceLocator
              ? `Source: ${source.sourceLocator}`
              : 'Unattributed source'
        ) ?? [],
      timeline: payload.stage
        ? `${payload.language ?? 'Unknown'} (${payload.stage})`
        : payload.language ?? 'Unknown timeline',
      ancestry: ancestry.length > 0
        ? ancestry
        : [{ stage: payload.textOriginal ?? word, language: payload.language ?? 'Unknown' }],
      languageFamily: payload.languageFamily ?? null,
      pronunciation: payload.pronunciation ?? null,
      periodLabel: payload.periodLabel ?? null,
      isReconstructed: payload.isReconstructed ?? false,
      relationshipSummary: payload.relationships
        ? {
            ancestors: payload.relationships.ancestors ?? 0,
            descendants: payload.relationships.descendants ?? 0,
            cognates: payload.relationships.cognates ?? 0,
            borrowings: payload.relationships.borrowings ?? 0,
          }
        : undefined,
      etymology: payload.etymology
        ? {
            ancestors: (payload.etymology.ancestors ?? []).map(normalizeEtymologyEdge),
            descendants: (payload.etymology.descendants ?? []).map(normalizeEtymologyEdge),
            cognates: (payload.etymology.cognates ?? []).map(normalizeEtymologyEdge),
            borrowings: (payload.etymology.borrowings ?? []).map(normalizeEtymologyEdge),
          }
        : undefined,
      confidence: payload.confidence
        ? {
            label: payload.confidence.label ?? 'Medium confidence',
            value: payload.confidence.value ?? null,
          }
        : undefined,
    };
  }
}

export const inspectorService = new InspectorService();
