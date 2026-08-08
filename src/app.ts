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

const UUID_V4_OR_V1_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_ENTITY_TYPES = new Set<string>(["word", "language", "family", "root"]);
const MAX_SEARCH_QUERY_LENGTH = 200;
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;
const MAX_REQUEST_SIZE_BYTES = 1024 * 1024;


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
  const allowedOrigins = parseAllowedOrigins();

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
    res.setHeader("X-Request-ID", requestId);

    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      console.info(JSON.stringify({
        requestId,
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

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "lexgraph-api" });
  });

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

    const start = Date.now();

    try {
      const candidates = await searchRepository.searchCandidates(q, {
        language,
        family,
        type: typeRaw as SearchEntityType | undefined,
      }, limit);
      const ranked = await searchRepository.rankCandidates(candidates, q);

      return res.status(200).json({
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
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to run search", error: String(error) });
    }
  });

  app.get("/v1/graph/:entityId/expand", async (req, res) => {
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

    const result = await graphService.expand({ entityId, direction, depth, relationshipTypes, entityTypes, limit: safeLimit, cursor });
    return res.status(200).set("X-Request-ID", requestId).json(result);
  });

  app.get("/v1/entities/:entityId/relationships", async (req, res) => {
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

    return res.status(200).set("X-Request-ID", requestId).json({
      relationships,
      meta: { limit: safeLimit, entityId, cursor, nextCursor: cursor ? `${cursor}-next` : "next" },
    });
  });

  app.get("/v1/words/:wordId", async (req, res) => {
    const { wordId } = req.params;
    if (!UUID_V4_OR_V1_REGEX.test(wordId)) {
      return res.status(400).json({ message: "Invalid wordId. Expected UUID." });
    }

    try {
      const details = await wordDetailsRepository.getWordDetails(wordId);
      if (!details) {
        return res.status(404).json({ message: "Word not found" });
      }

      return res.status(200).json(details);
    } catch (error) {
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
