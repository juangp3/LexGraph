import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import type { SearchCandidate, SearchRepository } from "../../src/repositories/interfaces.js";

function mockRepo(candidates: SearchCandidate[] = []): SearchRepository {
  return {
    searchCandidates: async () => candidates,
    rankCandidates: async (c) => c,
  };
}

function makeCandidate(overrides: Partial<SearchCandidate> = {}): SearchCandidate {
  return {
    wordId: "word-uuid",
    textOriginal: "father",
    textNormalized: "father",
    language: "English",
    languageFamily: "Germanic",
    stage: null,
    score: 1,
    type: "word",
    matchType: "exact",
    isReconstructed: false,
    ...overrides,
  };
}

describe("GET /v1/search – Phase 5", () => {
  it("returns 400 when query is missing", async () => {
    const app = createApp({ searchRepository: mockRepo() });
    const res = await request(app).get("/v1/search");
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Query q is required");
  });

  it("returns 400 when query exceeds 200 characters", async () => {
    const app = createApp({ searchRepository: mockRepo() });
    const q = "a".repeat(201);
    const res = await request(app).get(`/v1/search?q=${q}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("maximum length");
  });

  it("returns 400 for invalid entity type", async () => {
    const app = createApp({ searchRepository: mockRepo() });
    const res = await request(app).get("/v1/search?q=father&type=bogus");
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid type");
  });

  it("returns full search response schema", async () => {
    const app = createApp({ searchRepository: mockRepo([makeCandidate()]) });
    const res = await request(app).get("/v1/search?q=father");

    expect(res.status).toBe(200);
    expect(res.body.query).toBe("father");
    expect(res.body.filters).toBeDefined();
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.metadata).toBeDefined();
    expect(typeof res.body.metadata.executionTimeMs).toBe("number");
    expect(res.body.metadata.total).toBe(1);
  });

  it("maps candidate to result model with id and text fields", async () => {
    const app = createApp({
      searchRepository: mockRepo([makeCandidate({ textOriginal: "water", language: "German" })]),
    });
    const res = await request(app).get("/v1/search?q=water");
    const result = res.body.results[0];

    expect(result.id).toBeDefined();
    expect(result.text).toBe("water");
    expect(result.type).toBe("word");
    expect(result.match).toBeDefined();
    expect(result.match.type).toBe("exact");
    expect(result.language).toBe("German");
  });

  it("returns root type for reconstructed word", async () => {
    const app = createApp({
      searchRepository: mockRepo([makeCandidate({ type: "root", isReconstructed: true, textOriginal: "*ph₂tḗr" })]),
    });
    const res = await request(app).get("/v1/search?q=ph");
    const result = res.body.results[0];
    expect(result.type).toBe("root");
    expect(result.isReconstructed).toBe(true);
  });

  it("passes language filter to repository", async () => {
    let capturedFilters: unknown;
    const repo: SearchRepository = {
      searchCandidates: async (_q, filters) => {
        capturedFilters = filters;
        return [];
      },
      rankCandidates: async (c) => c,
    };
    const app = createApp({ searchRepository: repo });
    await request(app).get("/v1/search?q=father&language=English");
    expect((capturedFilters as { language: string }).language).toBe("English");
  });

  it("passes family filter to repository", async () => {
    let capturedFilters: unknown;
    const repo: SearchRepository = {
      searchCandidates: async (_q, filters) => {
        capturedFilters = filters;
        return [];
      },
      rankCandidates: async (c) => c,
    };
    const app = createApp({ searchRepository: repo });
    await request(app).get("/v1/search?q=father&family=Germanic");
    expect((capturedFilters as { family: string }).family).toBe("Germanic");
  });

  it("passes type filter to repository", async () => {
    let capturedFilters: unknown;
    const repo: SearchRepository = {
      searchCandidates: async (_q, filters) => {
        capturedFilters = filters;
        return [];
      },
      rankCandidates: async (c) => c,
    };
    const app = createApp({ searchRepository: repo });
    await request(app).get("/v1/search?q=proto&type=root");
    expect((capturedFilters as { type: string }).type).toBe("root");
  });

  it("accepts valid entity types", async () => {
    const app = createApp({ searchRepository: mockRepo() });
    for (const type of ["word", "language", "family", "root"]) {
      const res = await request(app).get(`/v1/search?q=test&type=${type}`);
      expect(res.status).toBe(200);
    }
  });
});
