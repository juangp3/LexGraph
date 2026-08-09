import { inspectorService } from '@/features/inspector/inspector.service';
import { vi } from 'vitest';

describe('inspectorService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and returns word metadata', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        textOriginal: 'father',
        language: 'English',
        stage: 'Modern English',
        meanings: [{ gloss: 'A male parent.' }],
        sources: [{ title: 'Etymonline' }],
      }),
    } as Response);

    const result = await inspectorService.getWordDetails('father');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/v1/words/father');
    expect(result.word).toBe('father');
    expect(result.meaning).toBe('A male parent.');
  });

  it('encodes unsafe characters in word path segment', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        textOriginal: 'cafe au lait',
        language: 'French',
        stage: 'French',
        meanings: [{ gloss: 'Coffee with milk.' }],
        sources: [{ title: 'Mock' }],
      }),
    } as Response);

    await inspectorService.getWordDetails('cafe au lait');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/v1/words/cafe%20au%20lait');
  });

  it('returns a graceful fallback for missing word metadata', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(inspectorService.getWordDetails('b580250c-c6e5-49ae-b220-6d0f9c379f84')).resolves.toMatchObject({
      word: 'b580250c-c6e5-49ae-b220-6d0f9c379f84',
      language: 'Unknown',
      meaning: 'Meaning unavailable for this node.',
      sources: [],
      ancestry: [{ stage: 'b580250c-c6e5-49ae-b220-6d0f9c379f84', language: 'Unknown' }],
    });
  });
});
