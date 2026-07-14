import { WordDetails } from '@/types/word-details';

class InspectorService {
  async getWordDetails(word: string): Promise<WordDetails> {
    const response = await fetch(`/api/words/${encodeURIComponent(word)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch word metadata (${response.status})`);
    }
    return response.json();
  }
}

export const inspectorService = new InspectorService();
