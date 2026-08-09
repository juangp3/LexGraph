type HttpRouteClass = 'health' | 'ready' | 'search' | 'graph' | 'word' | 'workspace' | 'import-status' | 'other';

interface Percentiles {
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

interface RouteMetrics {
  requests: number;
  errors: number;
  durationsMs: number[];
}

interface SearchMetrics {
  requests: number;
  errors: number;
  zeroResults: number;
  durationsMs: number[];
  resultCounts: number[];
}

interface GraphMetrics {
  requests: number;
  errors: number;
  truncated: number;
  durationsMs: number[];
  depths: number[];
  nodesReturned: number[];
  edgesReturned: number[];
}

interface DatabaseMetrics {
  queries: number;
  errors: number;
  slowQueries: number;
  durationsMs: number[];
}

interface CacheMetrics {
  requests: number;
  hits: number;
  misses: number;
  errors: number;
  durationsMs: number[];
}

function percentile(values: number[], ratio: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return Number(sorted[index].toFixed(2));
}

function summarize(values: number[]): Percentiles {
  return {
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
  };
}

function createRouteMetrics(): RouteMetrics {
  return { requests: 0, errors: 0, durationsMs: [] };
}

function createSearchMetrics(): SearchMetrics {
  return { requests: 0, errors: 0, zeroResults: 0, durationsMs: [], resultCounts: [] };
}

function createGraphMetrics(): GraphMetrics {
  return { requests: 0, errors: 0, truncated: 0, durationsMs: [], depths: [], nodesReturned: [], edgesReturned: [] };
}

function createDatabaseMetrics(): DatabaseMetrics {
  return { queries: 0, errors: 0, slowQueries: 0, durationsMs: [] };
}

function createCacheMetrics(): CacheMetrics {
  return { requests: 0, hits: 0, misses: 0, errors: 0, durationsMs: [] };
}

function classifyRoute(path: string): HttpRouteClass {
  if (path === '/health') return 'health';
  if (path === '/ready') return 'ready';
  if (path.startsWith('/v1/search')) return 'search';
  if (path.startsWith('/v1/graph')) return 'graph';
  if (path.startsWith('/v1/words')) return 'word';
  if (path.startsWith('/v1/me')) return 'workspace';
  if (path.startsWith('/v1/import-status')) return 'import-status';
  return 'other';
}

export class MetricsStore {
  private readonly startedAt = Date.now();
  private readonly routeMetrics = new Map<HttpRouteClass, RouteMetrics>();
  private readonly searchMetrics = createSearchMetrics();
  private readonly graphMetrics = createGraphMetrics();
  private readonly databaseMetrics = createDatabaseMetrics();
  private readonly cacheMetrics = createCacheMetrics();

  constructor() {
    for (const route of ['health', 'ready', 'search', 'graph', 'word', 'workspace', 'import-status', 'other'] as const) {
      this.routeMetrics.set(route, createRouteMetrics());
    }
  }

  reset() {
    for (const route of this.routeMetrics.keys()) {
      this.routeMetrics.set(route, createRouteMetrics());
    }

    Object.assign(this.searchMetrics, createSearchMetrics());
    Object.assign(this.graphMetrics, createGraphMetrics());
    Object.assign(this.databaseMetrics, createDatabaseMetrics());
    Object.assign(this.cacheMetrics, createCacheMetrics());
  }

  recordHttpRequest(input: { path: string; statusCode: number; durationMs: number }) {
    const bucket = this.routeMetrics.get(classifyRoute(input.path)) ?? createRouteMetrics();
    bucket.requests += 1;
    if (input.statusCode >= 400) {
      bucket.errors += 1;
    }
    bucket.durationsMs.push(input.durationMs);
    this.routeMetrics.set(classifyRoute(input.path), bucket);
  }

  recordSearch(input: { durationMs: number; resultCount: number; statusCode?: number }) {
    this.searchMetrics.requests += 1;
    if ((input.statusCode ?? 200) >= 400) {
      this.searchMetrics.errors += 1;
    }
    if (input.resultCount === 0) {
      this.searchMetrics.zeroResults += 1;
    }
    this.searchMetrics.durationsMs.push(input.durationMs);
    this.searchMetrics.resultCounts.push(input.resultCount);
  }

  recordGraph(input: { durationMs: number; depth: number; nodesReturned: number; edgesReturned: number; truncated?: boolean; statusCode?: number }) {
    this.graphMetrics.requests += 1;
    if ((input.statusCode ?? 200) >= 400) {
      this.graphMetrics.errors += 1;
    }
    if (input.truncated) {
      this.graphMetrics.truncated += 1;
    }
    this.graphMetrics.durationsMs.push(input.durationMs);
    this.graphMetrics.depths.push(input.depth);
    this.graphMetrics.nodesReturned.push(input.nodesReturned);
    this.graphMetrics.edgesReturned.push(input.edgesReturned);
  }

  recordDatabaseQuery(input: { durationMs: number; success: boolean }) {
    this.databaseMetrics.queries += 1;
    if (!input.success) {
      this.databaseMetrics.errors += 1;
    }
    if (input.durationMs >= 500) {
      this.databaseMetrics.slowQueries += 1;
    }
    this.databaseMetrics.durationsMs.push(input.durationMs);
  }

  recordCacheLookup(input: { durationMs: number; hit: boolean; success?: boolean }) {
    this.cacheMetrics.requests += 1;
    if (input.hit) {
      this.cacheMetrics.hits += 1;
    } else {
      this.cacheMetrics.misses += 1;
    }

    if (input.success === false) {
      this.cacheMetrics.errors += 1;
    }

    this.cacheMetrics.durationsMs.push(input.durationMs);
  }

  snapshot() {
    const successfulRequests = [...this.routeMetrics.values()]
      .reduce((total, route) => total + Math.max(0, route.requests - route.errors), 0);
    const uptimeHours = Math.max(1 / 3600, (Date.now() - this.startedAt) / (1000 * 60 * 60));
    const estimatedInfraCostUsdPerHour = Number(process.env.ESTIMATED_INFRA_COST_USD_PER_HOUR ?? 0);
    const estimatedCostUsdPerSuccessfulRequest = successfulRequests === 0
      ? null
      : Number(((estimatedInfraCostUsdPerHour * uptimeHours) / successfulRequests).toFixed(8));

    const routes = Object.fromEntries(
      [...this.routeMetrics.entries()].map(([route, metrics]) => [route, {
        requests: metrics.requests,
        errors: metrics.errors,
        percentilesMs: summarize(metrics.durationsMs),
      }])
    );

    return {
      http: {
        totalRequests: [...this.routeMetrics.values()].reduce((total, metrics) => total + metrics.requests, 0),
        totalErrors: [...this.routeMetrics.values()].reduce((total, metrics) => total + metrics.errors, 0),
        percentilesMs: summarize([...this.routeMetrics.values()].flatMap((metrics) => metrics.durationsMs)),
        routes,
      },
      search: {
        requests: this.searchMetrics.requests,
        errors: this.searchMetrics.errors,
        zeroResults: this.searchMetrics.zeroResults,
        resultCounts: {
          average: this.searchMetrics.resultCounts.length === 0
            ? null
            : Number((this.searchMetrics.resultCounts.reduce((sum, count) => sum + count, 0) / this.searchMetrics.resultCounts.length).toFixed(2)),
          max: this.searchMetrics.resultCounts.length === 0 ? null : Math.max(...this.searchMetrics.resultCounts),
        },
        percentilesMs: summarize(this.searchMetrics.durationsMs),
      },
      graph: {
        requests: this.graphMetrics.requests,
        errors: this.graphMetrics.errors,
        truncated: this.graphMetrics.truncated,
        averageDepth: this.graphMetrics.depths.length === 0
          ? null
          : Number((this.graphMetrics.depths.reduce((sum, depth) => sum + depth, 0) / this.graphMetrics.depths.length).toFixed(2)),
        averageNodes: this.graphMetrics.nodesReturned.length === 0
          ? null
          : Number((this.graphMetrics.nodesReturned.reduce((sum, count) => sum + count, 0) / this.graphMetrics.nodesReturned.length).toFixed(2)),
        averageEdges: this.graphMetrics.edgesReturned.length === 0
          ? null
          : Number((this.graphMetrics.edgesReturned.reduce((sum, count) => sum + count, 0) / this.graphMetrics.edgesReturned.length).toFixed(2)),
        percentilesMs: summarize(this.graphMetrics.durationsMs),
      },
      database: {
        queries: this.databaseMetrics.queries,
        errors: this.databaseMetrics.errors,
        slowQueries: this.databaseMetrics.slowQueries,
        percentilesMs: summarize(this.databaseMetrics.durationsMs),
      },
      cache: {
        requests: this.cacheMetrics.requests,
        hits: this.cacheMetrics.hits,
        misses: this.cacheMetrics.misses,
        errors: this.cacheMetrics.errors,
        hitRatio: this.cacheMetrics.requests === 0
          ? null
          : Number((this.cacheMetrics.hits / this.cacheMetrics.requests).toFixed(4)),
        percentilesMs: summarize(this.cacheMetrics.durationsMs),
      },
      cost: {
        successfulRequests,
        estimatedInfraCostUsdPerHour,
        estimatedCostUsdPerSuccessfulRequest,
      },
    };
  }
}

export const metrics = new MetricsStore();
export { classifyRoute };