import express from "express";
import { PgGraphRepository } from "./repositories/pg-graph.repository.js";

export function createApp() {
  const app = express();
  const graphRepository = new PgGraphRepository();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "lexgraph-api" });
  });

  app.get("/v1/search", (req, res) => {
    const q = String(req.query.q ?? "").trim();
    res.status(200).json({
      query: q,
      results: [],
      message: "Search endpoint scaffolded in Week 1"
    });
  });

  app.get("/v1/graph/ancestors/:wordId", async (req, res) => {
    try {
      const depth = Number(req.query.depth ?? 4);
      const edges = await graphRepository.findAncestors(req.params.wordId, depth);
      res.status(200).json({ wordId: req.params.wordId, depth, edges });
    } catch (error) {
      res.status(500).json({ message: "Failed to load ancestors", error: String(error) });
    }
  });

  app.get("/v1/graph/descendants/:wordId", async (req, res) => {
    try {
      const depth = Number(req.query.depth ?? 4);
      const edges = await graphRepository.findDescendants(req.params.wordId, depth);
      res.status(200).json({ wordId: req.params.wordId, depth, edges });
    } catch (error) {
      res.status(500).json({ message: "Failed to load descendants", error: String(error) });
    }
  });

  app.get("/v1/graph/borrowings/:wordId", async (req, res) => {
    try {
      const depth = Number(req.query.depth ?? 4);
      const edges = await graphRepository.findBorrowings(req.params.wordId, depth);
      res.status(200).json({ wordId: req.params.wordId, depth, edges });
    } catch (error) {
      res.status(500).json({ message: "Failed to load borrowings", error: String(error) });
    }
  });

  app.get("/v1/graph/cognates/:wordId", async (req, res) => {
    try {
      const depth = Number(req.query.depth ?? 4);
      const edges = await graphRepository.findCognates(req.params.wordId, depth);
      res.status(200).json({ wordId: req.params.wordId, depth, edges });
    } catch (error) {
      res.status(500).json({ message: "Failed to load cognates", error: String(error) });
    }
  });

  return app;
}
