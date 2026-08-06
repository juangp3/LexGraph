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

  it('throws a useful error for non-200 API responses', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(inspectorService.getWordDetails('missing')).rejects.toThrow(
      'Failed to fetch word metadata (404)'
    );
  });
});
