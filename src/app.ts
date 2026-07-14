import express from "express";

export function createApp() {
  const app = express();

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

  return app;
}
