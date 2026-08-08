import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import type {
  GraphRepository,
  SearchRepository,
  WordDetailsRepository,
} from "../../src/repositories/interfaces.js";

const validWordId = "11111111-1111-1111-8111-111111111111";

const graphRepository: GraphRepository = {
  upsertEdge: async () => undefined,
  findAncestors: async (wordId, depth) => [
    {
      edgeId: "edge-ancestor",
      fromWordId: "22222222-2222-2222-8222-222222222222",
      toWordId: wordId,
      relationType: "EVOLVED_FROM",
      confidence: 0.91,
      method: "manual",
      isDisputed: false,
      evidenceSummary: "system smoke fixture",
      depth,
      path: ["22222222-2222-2222-8222-222222222222", wordId],
      sources: [
        {
          sourceId: "33333333-3333-3333-8333-333333333333",
          sourceLocator: "entry-1",
          quoteExcerpt: "fixture",
          confidenceDelta: 0,
        },
      ],
    },
  ],
  findDescendants: async (wordId, depth) => [
    {
      edgeId: "edge-descendant",
      fromWordId: wordId,
      toWordId: "44444444-4444-4444-8444-444444444444",
      relationType: "EVOLVED_FROM",
      confidence: 0.8,
      method: "manual",
      isDisputed: false,
      evidenceSummary: "system smoke fixture",
      depth,
      path: [wordId, "44444444-4444-4444-8444-444444444444"],
      sources: [],
    },
  ],
  findBorrowings: async (wordId, depth) => [
    {
      edgeId: "edge-borrowing",
      fromWordId: "55555555-5555-5555-8555-555555555555",
      toWordId: wordId,
      relationType: "BORROWED_FROM",
      confidence: 0.7,
      method: "imported",
      isDisputed: false,
      evidenceSummary: "system smoke fixture",
      depth,
      path: ["55555555-5555-5555-8555-555555555555", wordId],
      sources: [],
    },
  ],
  findCognates: async (wordId, depth) => [
    {
      edgeId: "edge-cognate",
      fromWordId: wordId,
      toWordId: "66666666-6666-6666-8666-666666666666",
      relationType: "COGNATE_WITH",
      confidence: 0.6,
      method: "inferred",
      isDisputed: false,
      evidenceSummary: "system smoke fixture",
      depth,
      path: [wordId, "66666666-6666-6666-8666-666666666666"],
      sources: [],
    },
  ],  findRelationships: async () => [],};

const searchRepository: SearchRepository = {
  searchCandidates: async () => [
    {
      wordId: validWordId,
      textOriginal: "father",
      textNormalized: "father",
      language: "English",
      languageFamily: "Germanic",
      stage: "Modern English",
      score: 1,
      type: "word",
      matchType: "exact",
      isReconstructed: false,
    },
  ],
  rankCandidates: async (candidates) => candidates,
};

const wordDetailsRepository: WordDetailsRepository = {
  getWordDetails: async (wordId) => ({
    wordId,
    textOriginal: "father",
    textNormalized: "father",
    language: "English",
    stage: "Modern English",
    meanings: [{ gloss: "male parent", domain: null, usageNote: null }],
    sources: [
      {
        sourceId: "77777777-7777-7777-8777-777777777777",
        title: "System Source",
        author: "LexGraph",
        year: 2026,
        sourceLocator: "entry-1",
        confidence: 0.95,
      },
    ],
  }),
};

describe("system smoke", () => {
  const app = createApp({ graphRepository, searchRepository, wordDetailsRepository });

  it("serves /health", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it("serves /v1/search", async () => {
    const response = await request(app).get("/v1/search?q=father&limit=5");

    expect(response.status).toBe(200);
    expect(response.body.query).toBe("father");
    expect(response.body.total).toBeGreaterThanOrEqual(1);
    expect(response.body.results[0]).toMatchObject({
      wordId: validWordId,
      textOriginal: "father",
    });
  });

  it("serves /v1/words/:wordId", async () => {
    const response = await request(app).get(`/v1/words/${validWordId}`);

    expect(response.status).toBe(200);
    expect(response.body.wordId).toBe(validWordId);
    expect(response.body.meanings.length).toBeGreaterThanOrEqual(1);
    expect(response.body.sources[0].confidence).toBeGreaterThanOrEqual(0);
  });

  it("serves /v1/graph/* traversal endpoints", async () => {
    for (const route of ["ancestors", "descendants", "borrowings", "cognates"]) {
      const response = await request(app).get(`/v1/graph/${route}/${validWordId}?depth=3`);

      expect(response.status).toBe(200);
      expect(response.body.wordId).toBe(validWordId);
      expect(response.body.depth).toBe(3);
      expect(Array.isArray(response.body.edges)).toBe(true);
      expect(response.body.edges[0]).toHaveProperty("edgeId");
      expect(response.body.edges[0]).toHaveProperty("relationType");
    }
  });
});
