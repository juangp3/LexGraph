import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { PgWordDetailsRepository } from "../../src/repositories/pg-word-details.repository.js";

const shouldRun = process.env.RUN_INTEGRATION === "true";
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://lexgraph:lexgraph@localhost:5433/lexgraph";

let client: Client | null = null;

describe("integration: word details repository", () => {
  beforeAll(async () => {
    if (!shouldRun) {
      return;
    }

    client = new Client({ connectionString });
    await client.connect();
  });

  afterAll(async () => {
    if (!shouldRun || !client) {
      return;
    }

    await client.end();
  });

  it("skips when RUN_INTEGRATION is not enabled", () => {
    if (shouldRun) {
      expect(true).toBe(true);
      return;
    }

    expect(shouldRun).toBe(false);
  });

  it("returns normalized payload with meanings and source confidence", async () => {
    if (!shouldRun || !client) {
      return;
    }

    const family = await client.query<{ id: string }>(
      "INSERT INTO language_families(name, slug) VALUES ($1, $2) RETURNING id",
      ["Indo-European", `indo-european-word-details-${randomUUID()}`]
    );

    const language = await client.query<{ id: string }>(
      "INSERT INTO languages(family_id, name, stage_label) VALUES ($1, $2, $3) RETURNING id",
      [family.rows[0].id, "English", `Modern-${randomUUID()}`]
    );

    const word = await client.query<{ id: string }>(
      "INSERT INTO words(language_id, text_original, text_normalized, text_ascii_folded) VALUES ($1, $2, $3, $4) RETURNING id",
      [language.rows[0].id, "father", "father", "father"]
    );

    await client.query(
      "INSERT INTO meanings(word_id, gloss, usage_note) VALUES ($1, $2, $3)",
      [word.rows[0].id, "male parent", "fixture"]
    );

    const source = await client.query<{ id: string }>(
      "INSERT INTO sources(title, author, year) VALUES ($1, $2, $3) RETURNING id",
      [`Word Detail Source ${randomUUID()}`, "LexGraph", 2026]
    );

    await client.query(
      "INSERT INTO word_sources(word_id, source_id, source_locator, confidence) VALUES ($1, $2, $3, $4)",
      [word.rows[0].id, source.rows[0].id, "entry-1", 0.95]
    );

    const repository = new PgWordDetailsRepository();
    const details = await repository.getWordDetails(word.rows[0].id);

    expect(details).not.toBeNull();
    expect(details?.textNormalized).toBe("father");
    expect(details?.meanings.length).toBeGreaterThanOrEqual(1);
    expect(details?.sources.length).toBeGreaterThanOrEqual(1);
    expect(details?.sources[0].confidence).toBeGreaterThan(0.9);
  });
});
