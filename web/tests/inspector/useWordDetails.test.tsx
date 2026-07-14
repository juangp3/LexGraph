import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWordDetails } from '@/features/inspector/useWordDetails';
import { inspectorService } from '@/features/inspector/inspector.service';
import React from 'react';
import { vi } from 'vitest';

vi.mock('@/features/inspector/inspector.service', () => ({
  inspectorService: {
    getWordDetails: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
    }
  >
    {children}
  </QueryClientProvider>
);

describe('useWordDetails', () => {
  it('is disabled when no word is selected', () => {
    const spy = vi.mocked(inspectorService.getWordDetails);
    const { result } = renderHook(() => useWordDetails(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetches word details', async () => {
    vi.mocked(inspectorService.getWordDetails).mockResolvedValue({
      word: 'mother',
      language: 'English',
      meaning: 'A female parent.',
      timeline: 'Proto-Indo-European -> Modern English',
      sources: ['Etymonline'],
      ancestry: [{ language: 'Proto-Indo-European', stage: '*meh2ter' }],
    });

    const { result } = renderHook(() => useWordDetails('mother'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.word).toBe('mother');
    expect(result.current.data?.language).toBe('English');
    expect(result.current.data?.meaning).toBe('A female parent.');
    expect(inspectorService.getWordDetails).toHaveBeenCalledWith('mother');
  });
});
