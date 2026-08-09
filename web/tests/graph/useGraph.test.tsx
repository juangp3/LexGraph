import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGraph } from '@/features/graph/useGraph';
import { graphService } from '@/features/graph/graph.service';
import { vi } from 'vitest';

vi.mock('@/features/graph/graph.service', () => ({
  graphService: {
    fetchAncestorsFlow: vi.fn(),
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

describe('useGraph', () => {
  it('is disabled when root word id is null', () => {
    const spy = vi.mocked(graphService.fetchAncestorsFlow);
    const { result } = renderHook(() => useGraph(null), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetches graph for a valid root word id', async () => {
    vi.mocked(graphService.fetchAncestorsFlow).mockResolvedValue({
      nodes: [
        { id: 'root-id', data: { label: 'father' }, position: { x: 0, y: 0 } },
      ],
      edges: [],
    });

    const { result } = renderHook(() => useGraph('root-id', 4, 'father'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(graphService.fetchAncestorsFlow).toHaveBeenCalledWith('root-id', 4, 'father', expect.any(AbortSignal), 'hierarchical');
    expect(result.current.data?.nodes[0].data.label).toBe('father');
  });
});
