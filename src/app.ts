import express from "express";
import { PgGraphRepository } from "./repositories/pg-graph.repository.js";
import { PgSearchRepository } from "./repositories/pg-search.repository.js";
import type { GraphRepository, SearchRepository } from "./repositories/interfaces.js";

const UUID_V4_OR_V1_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const graphRepository = dependencies.graphRepository ?? new PgGraphRepository();
  const searchRepository = dependencies.searchRepository ?? new PgSearchRepository();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "lexgraph-api" });
  });

  app.get("/v1/search", async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const language = typeof req.query.language === "string" ? req.query.language : undefined;
    const limit = Number(req.query.limit ?? 10);

    if (!q) {
      return res.status(400).json({ message: "Query q is required" });
    }

    try {
      const candidates = await searchRepository.searchCandidates(q, language, limit);
      const ranked = await searchRepository.rankCandidates(candidates, q);

      return res.status(200).json({
        query: q,
        language: language ?? null,
        total: ranked.length,
        results: ranked
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to run search", error: String(error) });
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
