import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import type { WordDetailsRepository } from "../../src/repositories/interfaces.js";

describe("GET /v1/words/:wordId", () => {
  it("returns normalized detail payload", async () => {
    const wordId = "11111111-1111-1111-8111-111111111111";
    const mockRepository: WordDetailsRepository = {
      getWordDetails: async () => ({
        wordId,
        textOriginal: "father",
        textNormalized: "father",
        language: "English",
        stage: "Modern English",
        meanings: [{ gloss: "male parent", domain: null, usageNote: null }],
        sources: [
          {
            sourceId: "22222222-2222-2222-8222-222222222222",
            title: "Fixture",
            author: "LexGraph",
            year: 2026,
            sourceLocator: "entry-1",
            confidence: 1
          }
        ]
      })
    };

    const app = createApp({ wordDetailsRepository: mockRepository });
    const response = await request(app).get(`/v1/words/${wordId}`);

    expect(response.status).toBe(200);
    expect(response.body.wordId).toBe(wordId);
    expect(response.body.textNormalized).toBe("father");
    expect(response.body.meanings[0].gloss).toBe("male parent");
    expect(response.body.sources[0].confidence).toBe(1);
  });

  it("returns 400 for invalid UUID", async () => {
    const app = createApp();
    const response = await request(app).get("/v1/words/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid wordId");
  });

  it("returns 404 when repository has no match", async () => {
    const mockRepository: WordDetailsRepository = {
      getWordDetails: async () => null
    };

    const app = createApp({ wordDetailsRepository: mockRepository });
    const response = await request(app).get("/v1/words/11111111-1111-1111-8111-111111111111");

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("Word not found");
  });
});
