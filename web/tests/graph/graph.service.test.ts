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

      if (url.includes('/v1/search')) {
        return {
          ok: true,
          json: async () => ({ results: [] }),
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

      if (url.includes('/v1/search')) {
        return {
          ok: true,
          json: async () => ({ results: [] }),
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

  it('falls back to a candidate id with ancestry when initial root id has no edges', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes('/v1/graph/ancestors/root-id')) {
        return {
          ok: true,
          json: async () => ({
            wordId: 'root-id',
            depth: 6,
            edges: [],
          }),
        } as Response;
      }

      if (url.includes('/v1/search?q=father')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              { wordId: 'root-id', textOriginal: 'father', language: 'English' },
              { wordId: 'better-id', textOriginal: 'father', language: 'English' },
            ],
          }),
        } as Response;
      }

      if (url.includes('/v1/graph/ancestors/better-id')) {
        return {
          ok: true,
          json: async () => ({
            wordId: 'better-id',
            depth: 6,
            edges: [
              {
                edgeId: 'e1',
                fromWordId: 'ancestor-id',
                toWordId: 'better-id',
                relationType: 'EVOLVED_FROM',
                confidence: 0.9,
                method: 'manual',
                isDisputed: false,
                evidenceSummary: null,
                depth: 1,
                path: ['ancestor-id', 'better-id'],
                sources: [],
              },
            ],
          }),
        } as Response;
      }

      if (url.includes('/v1/words/ancestor-id')) {
        return {
          ok: true,
          json: async () => ({
            wordId: 'ancestor-id',
            textOriginal: 'ancestor',
            language: 'Latin',
          }),
        } as Response;
      }

      if (url.includes('/v1/words/better-id')) {
        return {
          ok: true,
          json: async () => ({
            wordId: 'better-id',
            textOriginal: 'father',
            language: 'English',
          }),
        } as Response;
      }

      return { ok: false, status: 404 } as Response;
    });

    const result = await graphService.fetchAncestorsFlow('root-id', 6, 'father');

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.nodes.map((n) => n.id)).toEqual(
      expect.arrayContaining(['ancestor-id', 'better-id'])
    );
  });
});
