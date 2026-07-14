import { graphService } from '@/features/graph/graph.service';
import { vi } from 'vitest';

describe('graphService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches ancestor graph and transforms to flow nodes/edges', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes('/v1/graph/ancestors/')) {
        return {
          ok: true,
          json: async () => ({
            wordId: 'root-id',
            depth: 2,
            edges: [
              {
                edgeId: 'edge-1',
                fromWordId: 'node-a',
                toWordId: 'root-id',
                relationType: 'EVOLVED_FROM',
                confidence: 0.9,
                method: 'manual',
                isDisputed: false,
                evidenceSummary: 'test',
                depth: 1,
                path: ['node-a', 'root-id'],
                sources: [],
              },
            ],
          }),
        } as Response;
      }

      if (url.includes('/v1/words/node-a')) {
        return {
          ok: true,
          json: async () => ({
            wordId: 'node-a',
            textOriginal: 'ancestor-a',
            language: 'Latin',
          }),
        } as Response;
      }

      if (url.includes('/v1/words/root-id')) {
        return {
          ok: true,
          json: async () => ({
            wordId: 'root-id',
            textOriginal: 'father',
            language: 'English',
          }),
        } as Response;
      }

      return { ok: false, status: 404 } as Response;
    });

    const result = await graphService.fetchAncestorsFlow('root-id', 2);

    expect(result.nodes.length).toBe(2);
    expect(result.edges.length).toBe(1);
    expect(result.nodes.map((n) => n.data.label)).toEqual(
      expect.arrayContaining(['ancestor-a', 'father'])
    );
  });

  it('returns root node even if no edges are available', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes('/v1/graph/ancestors/')) {
        return {
          ok: true,
          json: async () => ({
            wordId: 'root-id',
            depth: 1,
            edges: [],
          }),
        } as Response;
      }

      if (url.includes('/v1/words/root-id')) {
        return {
          ok: true,
          json: async () => ({
            wordId: 'root-id',
            textOriginal: 'singleton',
            language: 'English',
          }),
        } as Response;
      }

      return { ok: false, status: 404 } as Response;
    });

    const result = await graphService.fetchAncestorsFlow('root-id', 1);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    expect(result.nodes[0].data.label).toBe('singleton');
  });
});
