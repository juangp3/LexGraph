import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { metrics } from '../../src/observability/metrics.js';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('../../src/db/client.js', () => ({
  dbPool: {
    query: queryMock,
    connect: vi.fn(),
  },
}));

vi.mock('../../src/import/job-store.js', () => ({
  getLatestImportJob: vi.fn().mockResolvedValue(null),
  getRecentImportFailures: vi.fn().mockResolvedValue([]),
  getImportJobDetails: vi.fn().mockResolvedValue(null),
  getImportJobRawRecords: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../src/services/graph.service.js', () => ({
  GraphService: vi.fn().mockImplementation(() => ({
    expand: vi.fn().mockResolvedValue({
      nodes: [],
      edges: [],
      meta: { pagination: {} },
    }),
  })),
}));

vi.mock('../../src/repositories/pg-search.repository.js', () => ({
  PgSearchRepository: vi.fn().mockImplementation(() => ({
    searchCandidates: vi.fn().mockResolvedValue([]),
    rankCandidates: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../src/repositories/pg-word-details.repository.js', () => ({
  PgWordDetailsRepository: vi.fn().mockImplementation(() => ({
    getWordDetails: vi.fn().mockResolvedValue(null),
  })),
}));

beforeEach(() => {
  metrics.reset();
  queryMock.mockReset();
});

describe('phase 9 observability', () => {
  it('exposes readiness and version information', async () => {
    queryMock.mockResolvedValue({ rows: [{ '?column?': 1 }] });

    const app = createApp();

    const health = await request(app).get('/health').expect(200);
    const live = await request(app).get('/health/live').expect(200);
    const ready = await request(app).get('/health/ready').expect(200);
    const legacyReady = await request(app).get('/ready').expect(200);
    const version = await request(app).get('/v1/version').expect(200);

    expect(health.body.ok).toBe(true);
    expect(live.body.ok).toBe(true);
    expect(ready.body.ok).toBe(true);
    expect(legacyReady.body.ok).toBe(true);
    expect(version.body.service).toBe('lexgraph-api');
    expect(version.body.version).toBeTruthy();
  });

  it('records metrics for search and readiness traffic', async () => {
    queryMock.mockImplementation(async () => {
      metrics.recordDatabaseQuery({ durationMs: 1, success: true });
      return { rows: [{ '?column?': 1 }] };
    });

    const app = createApp();

    await request(app).get('/v1/search?q=moon').expect(200);
    await request(app).get('/ready').expect(200);

    const snapshot = await request(app).get('/v1/metrics').expect(200);

    expect(snapshot.body.http.totalRequests).toBeGreaterThanOrEqual(2);
    expect(snapshot.body.search.requests).toBe(1);
    expect(snapshot.body.search.percentilesMs.p50).not.toBeNull();
    expect(snapshot.body.database.queries).toBeGreaterThanOrEqual(1);
  });
});