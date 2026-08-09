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
      }),
      getWordDetailsBatch: async () => [],
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
      getWordDetails: async () => null,
      getWordDetailsBatch: async () => [],
    };

    const app = createApp({ wordDetailsRepository: mockRepository });
    const response = await request(app).get("/v1/words/11111111-1111-1111-8111-111111111111");

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("Word not found");
  });

  it("returns empty arrays for meanings and sources when repository payload is sparse", async () => {
    const wordId = "11111111-1111-1111-8111-111111111111";
    const mockRepository: WordDetailsRepository = {
      getWordDetails: async () => ({
        wordId,
        textOriginal: "father",
        textNormalized: "father",
        language: "English",
        stage: null,
        meanings: [],
        sources: []
      }),
      getWordDetailsBatch: async () => [],
    };

    const app = createApp({ wordDetailsRepository: mockRepository });
    const response = await request(app).get(`/v1/words/${wordId}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.meanings)).toBe(true);
    expect(Array.isArray(response.body.sources)).toBe(true);
    expect(response.body.meanings).toHaveLength(0);
    expect(response.body.sources).toHaveLength(0);
  });

  it("returns knowledge-panel metadata for the selected entity", async () => {
    const wordId = "11111111-1111-1111-8111-111111111111";
    const mockRepository: WordDetailsRepository = {
      getWordDetails: async () => ({
        wordId,
        textOriginal: "father",
        textNormalized: "father",
        language: "English",
        stage: "Modern English",
        meanings: [{ gloss: "male parent", domain: null, usageNote: null }],
        sources: [{
          sourceId: "22222222-2222-2222-8222-222222222222",
          title: "Fixture",
          author: "LexGraph",
          year: 2026,
          sourceLocator: "entry-1",
          confidence: 1
        }],
        languageFamily: "Germanic",
        pronunciation: "/ˈfɑːðə/",
        periodLabel: "c. 450–1150",
        isReconstructed: false,
        etymology: {
          ancestors: [{ relationType: "EVOLVED_FROM", targetWord: "fæder", targetLanguage: "Old English", targetStage: "Old English", confidence: 0.95 }],
          descendants: [],
          cognates: [],
          borrowings: []
        },
        relationships: { ancestors: 1, descendants: 0, cognates: 0, borrowings: 0 },
        confidence: { label: "High confidence", value: 0.95 }
      } as any),
      getWordDetailsBatch: async () => [],
    };

    const app = createApp({ wordDetailsRepository: mockRepository });
    const response = await request(app).get(`/v1/words/${wordId}`);

    expect(response.status).toBe(200);
    expect(response.body.languageFamily).toBe("Germanic");
    expect(response.body.pronunciation).toBe("/ˈfɑːðə/");
    expect(response.body.relationships.ancestors).toBe(1);
    expect(response.body.etymology.ancestors[0].targetWord).toBe("fæder");
  });

  it("returns 500 when repository throws", async () => {
    const mockRepository: WordDetailsRepository = {
      getWordDetails: async () => {
        throw new Error("repository boom");
      },
      getWordDetailsBatch: async () => [],
    };

    const app = createApp({ wordDetailsRepository: mockRepository });
    const response = await request(app).get("/v1/words/11111111-1111-1111-8111-111111111111");

    expect(response.status).toBe(500);
    expect(response.body.message).toContain("Failed to load word details");
  });
});
