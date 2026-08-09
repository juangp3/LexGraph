import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { PgGraphRepository } from "./repositories/pg-graph.repository.js";
import { PgSearchRepository } from "./repositories/pg-search.repository.js";
import { PgWordDetailsRepository } from "./repositories/pg-word-details.repository.js";
import type {
  GraphRepository,
  SearchEntityType,
  SearchRepository,
  WordDetailsRepository
} from "./repositories/interfaces.js";
import { GraphService } from "./services/graph.service.js";
import graphRoutes from './routes/graph.routes.js';
import { dbPool } from './db/client.js';
import { getLatestImportJob, getRecentImportFailures } from './import/job-store.js';
import { metrics } from './observability/metrics.js';
import { MemoryCacheStore } from './cache/memory-cache.js';
import { graphExpandCacheKey, searchCacheKey, wordDetailCacheKey } from './cache/keys.js';
import { AuthOrchestrator } from './auth/auth.orchestrator.js';
import { PgAuthStore } from './auth/pg-auth.store.js';
import { WorkspaceOrchestrator } from './workspace/workspace.orchestrator.js';
import { PgWorkspaceStore } from './workspace/pg-workspace.store.js';
import { buildAuthRouter } from './routes/auth.routes.js';
import { buildMeRouter } from './routes/me.routes.js';

const UUID_V4_OR_V1_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_ENTITY_TYPES = new Set<string>(["word", "language", "family", "root"]);
const MAX_SEARCH_QUERY_LENGTH = 200;
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;
const MAX_REQUEST_SIZE_BYTES = 1024 * 1024;
const SERVICE_VERSION = process.env.APP_VERSION ?? process.env.npm_package_version ?? '0.1.0';
const DATASET_VERSION = process.env.DATASET_VERSION ?? '2026-08';
const DEFAULT_QUERY_TIMEOUT_MS = Number(process.env.API_QUERY_TIMEOUT_MS ?? 2000);
const GRAPH_QUERY_TIMEOUT_MS = Number(process.env.GRAPH_QUERY_TIMEOUT_MS ?? 4000);
const SEARCH_TTL_MS = Number(process.env.SEARCH_CACHE_TTL_MS ?? 60_000);
const WORD_DETAIL_TTL_MS = Number(process.env.WORD_CACHE_TTL_MS ?? 5 * 60_000);
const GRAPH_EXPAND_TTL_MS = Number(process.env.GRAPH_EXPAND_CACHE_TTL_MS ?? 5 * 60_000);
const MAX_CONCURRENT_GRAPH_PER_KEY = Number(process.env.GRAPH_MAX_CONCURRENT_PER_KEY ?? 2);

class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number, message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function cacheLookup<T>(
  cache: MemoryCacheStore,
  key: string,
): { hit: boolean; value: T | null } {
  const startedAt = Date.now();
  try {
    const result = cache.get<T>(key);
    metrics.recordCacheLookup({ durationMs: Date.now() - startedAt, hit: result.hit, success: true });
    return result;
  } catch {
    metrics.recordCacheLookup({ durationMs: Date.now() - startedAt, hit: false, success: false });
    return { hit: false, value: null };
  }
}

function graphClientKey(req: express.Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || 'unknown-client';
}


function parseDepth(raw: unknown): number | null {
  const parsed = Number(raw ?? 4);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) {
    return null;
  }

  return Math.floor(parsed);
}

function validateGraphRequest(wordId: string, rawDepth: unknown) {
  if (!UUID_V4_OR_V1_REGEX.test(wordId)) {
    return { ok: false as const, message: "Invalid wordId. Expected UUID." };
  }

  const depth = parseDepth(rawDepth);
  if (depth === null) {
    return { ok: false as const, message: "Invalid depth. Use an integer between 1 and 10." };
  }

  return { ok: true as const, depth };
}

interface AppDependencies {
  graphRepository?: GraphRepository;
  searchRepository?: SearchRepository;
  wordDetailsRepository?: WordDetailsRepository;
  authOrchestrator?: AuthOrchestrator;
  workspaceOrchestrator?: WorkspaceOrchestrator;
}

function parseAllowedOrigins(): string[] {
  const single = process.env.FRONTEND_URL;
  const multiple = process.env.FRONTEND_URLS;

  const configured = [single, ...(multiple ? multiple.split(",") : [])]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin));

  if (configured.length > 0) {
    return configured;
  }

  return ["http://localhost:3000", "http://127.0.0.1:3000"];
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const graphRepository = dependencies.graphRepository ?? new PgGraphRepository();
  const searchRepository = dependencies.searchRepository ?? new PgSearchRepository();
  const wordDetailsRepository = dependencies.wordDetailsRepository ?? new PgWordDetailsRepository();
  const graphService = new GraphService(graphRepository);
  const authOrchestrator = dependencies.authOrchestrator ?? new AuthOrchestrator(new PgAuthStore());
  const workspaceOrchestrator = dependencies.workspaceOrchestrator ?? new WorkspaceOrchestrator(new PgWorkspaceStore());
  const allowedOrigins = parseAllowedOrigins();
  const cache = new MemoryCacheStore();
  const graphConcurrency = new Map<string, number>();

  app.use(cors({
    origin: (origin, callback) => {
      // Allow server-to-server and local tooling requests without Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.includes(origin));
    }
  }));
  app.use((req, _res, next) => {
    const requestId = String(req.headers["x-request-id"] ?? crypto.randomUUID());
    req.headers["x-request-id"] = requestId;
    next();
  });

  app.use((req, res, next) => {
    const contentLength = Number(req.headers["content-length"] ?? 0);
    if (contentLength > MAX_REQUEST_SIZE_BYTES) {
      const requestId = String(req.headers["x-request-id"] ?? crypto.randomUUID());
      return res.status(413).set("X-Request-ID", requestId).json({
        error: { code: "REQUEST_TOO_LARGE", message: "Request body exceeds the allowed size.", requestId },
      });
    }

    next();
  });

  app.use(express.json({ limit: `${MAX_REQUEST_SIZE_BYTES}b` }));
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    const requestId = String(_req.headers["x-request-id"] ?? crypto.randomUUID());

    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).set("X-Request-ID", requestId).json({
        error: { code: "INVALID_REQUEST", message: "Malformed JSON body.", requestId },
      });
    }

    const payloadError = err as { type?: string; code?: string } | undefined;
    if (payloadError?.type === "entity.too.large" || payloadError?.code === "LIMIT_FILE_SIZE" || payloadError?.type === "request.entity.too.large") {
      return res.status(413).set("X-Request-ID", requestId).json({
        error: { code: "REQUEST_TOO_LARGE", message: "Request body exceeds the allowed size.", requestId },
      });
    }

    next(err);
  });

  app.use((req, res, next) => {
    const startedAt = Date.now();
    const requestId = String(req.headers["x-request-id"] ?? crypto.randomUUID());
    const traceId = crypto.randomUUID().replace(/-/g, '');
    res.setHeader("X-Request-ID", requestId);
    res.setHeader("X-Trace-ID", traceId);

    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      metrics.recordHttpRequest({
        path: req.originalUrl.split('?')[0],
        statusCode: res.statusCode,
        durationMs,
      });
      console.info(JSON.stringify({
        requestId,
        traceId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
      }));
    });

    next();
  });

  const searchRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many search requests. Please slow down." },
  });

  const graphRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many graph requests. Please reduce frequency.' },
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "lexgraph-api", version: SERVICE_VERSION, datasetVersion: DATASET_VERSION });
  });

  app.get("/ready", async (_req, res) => {
    try {
      await dbPool.query('SELECT 1');
      return res.status(200).json({ ok: true, service: 'lexgraph-api', version: SERVICE_VERSION, datasetVersion: DATASET_VERSION });
    } catch (error) {
      return res.status(503).json({ ok: false, service: 'lexgraph-api', version: SERVICE_VERSION, datasetVersion: DATASET_VERSION, error: String(error) });
    }
  });

  app.get('/v1/version', (_req, res) => {
    res.status(200).json({ service: 'lexgraph-api', version: SERVICE_VERSION, datasetVersion: DATASET_VERSION });
  });

  app.get('/v1/metrics', (_req, res) => {
    res.status(200).json(metrics.snapshot());
  });

  app.use('/v1/auth', buildAuthRouter(authOrchestrator));
  app.use('/v1/me', buildMeRouter(authOrchestrator, workspaceOrchestrator));

  app.use('/v1/graph', graphRoutes);

  app.get("/v1/import-status", async (_req, res) => {
    try {
      const client = await dbPool.connect();
      try {
        const latest = await getLatestImportJob(client);
        const failures = await getRecentImportFailures(client, 5);
        return res.status(200).json({ latest, failures });
      } finally {
        client.release();
      }
    } catch (error) {
      return res.status(500).json({ message: "Failed to load import status", error: String(error) });
    }
  });

  app.get("/v1/search", searchRateLimiter, async (req, res) => {
    const startedAt = Date.now();
    const q = String(req.query.q ?? "").trim();
    const language = typeof req.query.language === "string" ? req.query.language.trim() : undefined;
    const family = typeof req.query.family === "string" ? req.query.family.trim() : undefined;
    const typeRaw = typeof req.query.type === "string" ? req.query.type.trim() : undefined;
    const rawLimit = Number(req.query.limit ?? DEFAULT_SEARCH_LIMIT);

    if (!q) {
      return res.status(400).json({ message: "Query q is required" });
    }

    if (q.length > MAX_SEARCH_QUERY_LENGTH) {
      return res.status(400).json({
        message: `Query exceeds maximum length of ${MAX_SEARCH_QUERY_LENGTH} characters`,
      });
    }

    if (typeRaw && !VALID_ENTITY_TYPES.has(typeRaw)) {
      return res.status(400).json({
        message: `Invalid type. Use one of: ${[...VALID_ENTITY_TYPES].join(", ")}`,
      });
    }

    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(rawLimit, MAX_SEARCH_LIMIT))
      : DEFAULT_SEARCH_LIMIT;

    const cacheKey = searchCacheKey({ query: q, language, family, type: typeRaw, limit });
    const cached = cacheLookup<unknown>(cache, cacheKey);
    if (cached.hit && cached.value) {
      metrics.recordSearch({ durationMs: Date.now() - startedAt, resultCount: Number((cached.value as { total?: number }).total ?? 0), statusCode: 200 });
      return res.status(200).json(cached.value);
    }

    const start = Date.now();

    try {
      const candidates = await withTimeout(searchRepository.searchCandidates(q, {
        language,
        family,
        type: typeRaw as SearchEntityType | undefined,
      }, limit), DEFAULT_QUERY_TIMEOUT_MS);
      const ranked = await withTimeout(searchRepository.rankCandidates(candidates, q), DEFAULT_QUERY_TIMEOUT_MS);
      metrics.recordSearch({ durationMs: Date.now() - startedAt, resultCount: ranked.length, statusCode: 200 });

      const response = {
        query: q,
        total: ranked.length,
        filters: {
          language: language ?? null,
          family: family ?? null,
          type: typeRaw ?? null,
        },
        results: ranked.map((r) => ({
          id: r.wordId,
          wordId: r.wordId,
          type: r.type,
          text: r.textOriginal,
          textOriginal: r.textOriginal,
          language: r.language || null,
          languageFamily: r.languageFamily,
          stage: r.stage,
          isReconstructed: r.isReconstructed,
          match: {
            type: r.matchType,
            score: r.score,
          },
        })),
        metadata: {
          total: ranked.length,
          executionTimeMs: Date.now() - start,
        },
      };

      cache.set(cacheKey, response, SEARCH_TTL_MS);
      return res.status(200).json(response);
    } catch (error) {
      if (error instanceof TimeoutError) {
        return res.status(504).json({ message: `Search timed out after ${error.timeoutMs}ms` });
      }
      metrics.recordSearch({ durationMs: Date.now() - startedAt, resultCount: 0, statusCode: 500 });
      return res.status(500).json({ message: "Failed to run search", error: String(error) });
    }
  });

  app.get("/v1/graph/:entityId/expand", graphRateLimiter, async (req, res) => {
    const startedAt = Date.now();
    const requestId = String(req.headers["x-request-id"] ?? crypto.randomUUID());
    const { entityId } = req.params;
    if (!UUID_V4_OR_V1_REGEX.test(entityId)) {
      return res.status(400).set("X-Request-ID", requestId).json({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid entityId. Expected UUID.",
          requestId,
        },
      });
    }

    const direction = typeof req.query.direction === "string" ? req.query.direction : "ancestors";
    const relationshipTypes = typeof req.query.relationshipTypes === "string"
      ? req.query.relationshipTypes.split(",").map((value) => value.trim()).filter(Boolean)
      : undefined;
    const entityTypes = typeof req.query.entityTypes === "string"
      ? req.query.entityTypes.split(",").map((value) => value.trim()).filter(Boolean)
      : undefined;
    const limit = Number(req.query.limit ?? 25);
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), 100)) : 25;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const depth = parseDepth(req.query.depth);
    if (depth === null) {
      return res.status(400).set("X-Request-ID", requestId).json({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid depth. Use an integer between 1 and 10.",
          requestId,
        },
      });
    }

    const clientKey = graphClientKey(req);
    const activeGraphRequests = graphConcurrency.get(clientKey) ?? 0;
    if (activeGraphRequests >= MAX_CONCURRENT_GRAPH_PER_KEY) {
      return res.status(429).set('X-Request-ID', requestId).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many concurrent graph requests for this client.',
          requestId,
        },
      });
    }

    const cacheKey = graphExpandCacheKey({ entityId, direction, depth, relationshipTypes, entityTypes, limit: safeLimit, cursor });
    const cached = cacheLookup<unknown>(cache, cacheKey);
    if (cached.hit && cached.value) {
      return res.status(200).set('X-Request-ID', requestId).json(cached.value);
    }

    graphConcurrency.set(clientKey, activeGraphRequests + 1);
    try {
      const result = await withTimeout(
        graphService.expand({ entityId, direction, depth, relationshipTypes, entityTypes, limit: safeLimit, cursor }),
        GRAPH_QUERY_TIMEOUT_MS,
      );
      metrics.recordGraph({
        durationMs: Date.now() - startedAt,
        depth,
        nodesReturned: result.nodes.length,
        edgesReturned: result.edges.length,
        truncated: Boolean(result.meta?.truncated),
      });
      cache.set(cacheKey, result, GRAPH_EXPAND_TTL_MS);
      return res.status(200).set("X-Request-ID", requestId).json(result);
    } catch (error) {
      if (error instanceof TimeoutError) {
        metrics.recordGraph({ durationMs: Date.now() - startedAt, depth, nodesReturned: 0, edgesReturned: 0, truncated: false, statusCode: 504 });
        return res.status(504).set('X-Request-ID', requestId).json({
          error: {
            code: 'QUERY_TIMEOUT',
            message: `Graph expansion exceeded ${error.timeoutMs}ms timeout.`,
            requestId,
          },
        });
      }

      metrics.recordGraph({ durationMs: Date.now() - startedAt, depth, nodesReturned: 0, edgesReturned: 0, truncated: false, statusCode: 500 });
      return res.status(500).set('X-Request-ID', requestId).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to expand graph.',
          requestId,
        },
      });
    } finally {
      const current = graphConcurrency.get(clientKey) ?? 1;
      if (current <= 1) {
        graphConcurrency.delete(clientKey);
      } else {
        graphConcurrency.set(clientKey, current - 1);
      }
    }
  });

  app.get("/v1/entities/:entityId/relationships", async (req, res) => {
    const startedAt = Date.now();
    const requestId = String(req.headers["x-request-id"] ?? crypto.randomUUID());
    const { entityId } = req.params;
    if (!UUID_V4_OR_V1_REGEX.test(entityId)) {
      return res.status(400).set("X-Request-ID", requestId).json({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid entityId. Expected UUID.",
          requestId,
        },
      });
    }

    const limit = Number(req.query.limit ?? 25);
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), 100)) : 25;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const relationships = await graphRepository.findRelationships(entityId, { limit: safeLimit, cursor });

    const response = {
      relationships,
      meta: { limit: safeLimit, entityId, cursor, nextCursor: cursor ? `${cursor}-next` : "next" },
    };

    metrics.recordGraph({
      durationMs: Date.now() - startedAt,
      depth: 1,
      nodesReturned: 0,
      edgesReturned: relationships.length,
      truncated: false,
    });

    return res.status(200).set("X-Request-ID", requestId).json(response);
  });

  app.get("/v1/words/:wordId", async (req, res) => {
    const { wordId } = req.params;
    if (!UUID_V4_OR_V1_REGEX.test(wordId)) {
      return res.status(400).json({ message: "Invalid wordId. Expected UUID." });
    }

    try {
      const cacheKey = wordDetailCacheKey(wordId);
      const cached = cacheLookup<unknown>(cache, cacheKey);
      if (cached.hit && cached.value) {
        return res.status(200).json(cached.value);
      }

      const details = await withTimeout(wordDetailsRepository.getWordDetails(wordId), DEFAULT_QUERY_TIMEOUT_MS);
      if (!details) {
        return res.status(404).json({ message: "Word not found" });
      }

      cache.set(cacheKey, details, WORD_DETAIL_TTL_MS);

      return res.status(200).json(details);
    } catch (error) {
      if (error instanceof TimeoutError) {
        return res.status(504).json({ message: `Word lookup timed out after ${error.timeoutMs}ms` });
      }
      return res.status(500).json({ message: "Failed to load word details", error: String(error) });
    }
  });

  app.get("/v1/graph/ancestors/:wordId", async (req, res) => {
    const validation = validateGraphRequest(req.params.wordId, req.query.depth);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    try {
      const depth = validation.depth;
      const edges = await graphRepository.findAncestors(req.params.wordId, depth);
      res.status(200).json({ wordId: req.params.wordId, depth, edges });
    } catch (error) {
      res.status(500).json({ message: "Failed to load ancestors", error: String(error) });
    }
  });

  app.get("/v1/graph/descendants/:wordId", async (req, res) => {
    const validation = validateGraphRequest(req.params.wordId, req.query.depth);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    try {
      const depth = validation.depth;
      const edges = await graphRepository.findDescendants(req.params.wordId, depth);
      res.status(200).json({ wordId: req.params.wordId, depth, edges });
    } catch (error) {
      res.status(500).json({ message: "Failed to load descendants", error: String(error) });
    }
  });

  app.get("/v1/graph/borrowings/:wordId", async (req, res) => {
    const validation = validateGraphRequest(req.params.wordId, req.query.depth);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    try {
      const depth = validation.depth;
      const edges = await graphRepository.findBorrowings(req.params.wordId, depth);
      res.status(200).json({ wordId: req.params.wordId, depth, edges });
    } catch (error) {
      res.status(500).json({ message: "Failed to load borrowings", error: String(error) });
    }
  });

  app.get("/v1/graph/cognates/:wordId", async (req, res) => {
    const validation = validateGraphRequest(req.params.wordId, req.query.depth);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    try {
      const depth = validation.depth;
      const edges = await graphRepository.findCognates(req.params.wordId, depth);
      res.status(200).json({ wordId: req.params.wordId, depth, edges });
    } catch (error) {
      res.status(500).json({ message: "Failed to load cognates", error: String(error) });
    }
  });

  return app;
}
