import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { PgSearchRepository } from "../../src/repositories/pg-search.repository.js";

const shouldRun = process.env.RUN_INTEGRATION === "true";
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://lexgraph:lexgraph@localhost:5433/lexgraph";

let client: Client | null = null;

describe("integration: search repository", () => {
  const searchRepository = new PgSearchRepository();
  let languageName = "";

  beforeAll(async () => {
    if (!shouldRun) {
      return;
    }

    client = new Client({ connectionString });
    await client.connect();

    const family = await client.query<{ id: string }>(
      "INSERT INTO language_families(name, slug) VALUES ($1, $2) RETURNING id",
      ["Week5 Family", `week5-family-${randomUUID()}`]
    );

    languageName = `Week5English-${randomUUID()}`;

    const language = await client.query<{ id: string }>(
      "INSERT INTO languages(family_id, name, stage_label) VALUES ($1, $2, $3) RETURNING id",
      [family.rows[0].id, languageName, "Week5 Stage"]
    );

    const words = [
      ["father", "father", "father"],
      ["faeder", "faeder", "faeder"],
      ["phater", "phater", "phater"]
    ];

    for (const [original, normalized, asciiFolded] of words) {
      await client.query(
        "INSERT INTO words(language_id, text_original, text_normalized, text_ascii_folded) VALUES ($1, $2, $3, $4)",
        [language.rows[0].id, original, normalized, asciiFolded]
      );
    }
  });

  afterAll(async () => {
    if (!shouldRun || !client) {
      return;
    }

    await client.end();
  });

  it("returns exact match first for ranked father query", async () => {
    if (!shouldRun) {
      expect(true).toBe(true);
      return;
    }

    const candidates = await searchRepository.searchCandidates("father", { language: languageName }, 10);
    const ranked = await searchRepository.rankCandidates(candidates, "father");

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].textNormalized).toBe("father");
  });

  it("supports fuzzy variant query", async () => {
    if (!shouldRun) {
      expect(true).toBe(true);
      return;
    }

    const candidates = await searchRepository.searchCandidates("fader", { language: languageName }, 10);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((candidate) => candidate.textOriginal === "faeder")).toBe(true);
  });

  it("honors language filter", async () => {
    if (!shouldRun) {
      expect(true).toBe(true);
      return;
    }

    const candidates = await searchRepository.searchCandidates("father", { language: languageName }, 10);
    expect(candidates.every((candidate) => candidate.language === languageName)).toBe(true);
  });
});
