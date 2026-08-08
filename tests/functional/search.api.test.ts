import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import type { SearchRepository } from "../../src/repositories/interfaces.js";

describe("GET /v1/search", () => {
  it("returns ranked search payload", async () => {
    const mockRepository: SearchRepository = {
      searchCandidates: async () => [
        {
          wordId: "1",
          textOriginal: "father",
          textNormalized: "father",
          language: "English",
          languageFamily: "Germanic",
          stage: "Modern English",
          score: 1,
          type: "word",
          matchType: "exact",
          isReconstructed: false,
        }
      ],
      rankCandidates: async (candidates) => candidates
    };

    const app = createApp({ searchRepository: mockRepository });
    const response = await request(app).get("/v1/search?q=father");

    expect(response.status).toBe(200);
    expect(response.body.query).toBe("father");
    expect(response.body.metadata.total).toBe(1);
    expect(Array.isArray(response.body.results)).toBe(true);
    expect(response.body.results[0].text).toBe("father");
  });

  it("returns 400 when query is missing", async () => {
    const app = createApp();
    const response = await request(app).get("/v1/search");

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Query q is required");
  });
});
