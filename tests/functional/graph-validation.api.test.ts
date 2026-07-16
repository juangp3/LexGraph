import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import type { GraphRepository } from "../../src/repositories/interfaces.js";

const validUuid = "11111111-1111-1111-8111-111111111111";

const graphRepository: GraphRepository = {
  upsertEdge: async () => undefined,
  findAncestors: async (wordId) => [
    {
      edgeId: "e-1",
      fromWordId: "22222222-2222-2222-8222-222222222222",
      toWordId: wordId,
      relationType: "EVOLVED_FROM",
      confidence: 0.9,
      method: "manual",
      isDisputed: false,
      evidenceSummary: null,
      depth: 1,
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
      edgeId: "e-2",
      fromWordId: wordId,
      toWordId: "44444444-4444-4444-8444-444444444444",
      relationType: "EVOLVED_FROM",
      confidence: 0.8,
      method: "manual",
      isDisputed: false,
      evidenceSummary: null,
      depth,
      path: [wordId, "44444444-4444-4444-8444-444444444444"],
      sources: [],
    },
  ],
  findBorrowings: async (wordId, depth) => [
    {
      edgeId: "e-3",
      fromWordId: "55555555-5555-5555-8555-555555555555",
      toWordId: wordId,
      relationType: "BORROWED_FROM",
      confidence: 0.7,
      method: "imported",
      isDisputed: false,
      evidenceSummary: null,
      depth,
      path: ["55555555-5555-5555-8555-555555555555", wordId],
      sources: [],
    },
  ],
  findCognates: async (wordId, depth) => [
    {
      edgeId: "e-4",
      fromWordId: wordId,
      toWordId: "66666666-6666-6666-8666-666666666666",
      relationType: "COGNATE_WITH",
      confidence: 0.6,
      method: "inferred",
      isDisputed: false,
      evidenceSummary: null,
      depth,
      path: [wordId, "66666666-6666-6666-8666-666666666666"],
      sources: [],
    },
  ],
};

describe("graph endpoint validation", () => {
  it("rejects placeholder wordId with 400", async () => {
    const app = createApp();
    const response = await request(app).get("/v1/graph/ancestors/%7BwordId%7D?depth=4");

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid wordId");
  });

  it("rejects out-of-range depth with 400", async () => {
    const app = createApp();
    const response = await request(app).get(`/v1/graph/ancestors/${validUuid}?depth=99`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid depth");
  });

  it("returns consistent success contract for all graph traversal routes", async () => {
    const app = createApp({ graphRepository });

    for (const route of ["ancestors", "descendants", "borrowings", "cognates"]) {
      const response = await request(app).get(`/v1/graph/${route}/${validUuid}?depth=4`);

      expect(response.status).toBe(200);
      expect(response.body.wordId).toBe(validUuid);
      expect(response.body.depth).toBe(4);
      expect(Array.isArray(response.body.edges)).toBe(true);
      expect(response.body.edges[0]).toHaveProperty("edgeId");
      expect(response.body.edges[0]).toHaveProperty("fromWordId");
      expect(response.body.edges[0]).toHaveProperty("toWordId");
      expect(response.body.edges[0]).toHaveProperty("relationType");
      expect(response.body.edges[0]).toHaveProperty("confidence");
      expect(response.body.edges[0]).toHaveProperty("sources");
    }
  });
});
