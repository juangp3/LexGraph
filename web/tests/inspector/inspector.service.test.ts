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
        word: 'father',
        language: 'English',
        meaning: 'A male parent.',
        timeline: 'Proto-Indo-European -> Modern English',
        sources: ['Etymonline'],
        ancestry: [{ language: 'Proto-Indo-European', stage: '*ph2ter' }],
      }),
    } as Response);

    const result = await inspectorService.getWordDetails('father');

    expect(fetchMock).toHaveBeenCalledWith('/api/words/father');
    expect(result.word).toBe('father');
    expect(result.meaning).toBe('A male parent.');
  });

  it('encodes unsafe characters in word path segment', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        word: 'cafe au lait',
        language: 'French',
        meaning: 'Coffee with milk.',
        timeline: 'French',
        sources: ['Mock'],
        ancestry: [{ language: 'French', stage: 'cafe au lait' }],
      }),
    } as Response);

    await inspectorService.getWordDetails('cafe au lait');

    expect(fetchMock).toHaveBeenCalledWith('/api/words/cafe%20au%20lait');
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
