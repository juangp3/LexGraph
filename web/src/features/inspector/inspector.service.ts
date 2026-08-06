import { WordDetails } from '@/types/word-details';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

interface BackendWordDetailsResponse {
  textOriginal?: string;
  language?: string;
  stage?: string | null;
  meanings?: Array<{ gloss?: string | null }>;
  sources?: Array<{ title?: string | null; sourceLocator?: string | null }>;
}

class InspectorService {
  async getWordDetails(word: string): Promise<WordDetails> {
    const response = await fetch(`${API_BASE}/v1/words/${encodeURIComponent(word)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch word metadata (${response.status})`);
    }

    const payload = (await response.json()) as BackendWordDetailsResponse;

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
      ancestry: [{ stage: payload.textOriginal ?? word, language: payload.language ?? 'Unknown' }],
    };
  }
}

export const inspectorService = new InspectorService();
