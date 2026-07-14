import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const shouldRun = process.env.RUN_INTEGRATION === "true";
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://lexgraph:lexgraph@localhost:5433/lexgraph";

let client: Client | null = null;

describe("integration: relational core", () => {
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

  it("blocks duplicate canonical words per language", async () => {
    if (!shouldRun || !client) {
      return;
    }

    const family = await client.query<{ id: string }>(
      "INSERT INTO language_families(name, slug) VALUES ($1, $2) RETURNING id",
      ["Indo-European", `indo-european-${randomUUID()}`]
    );

    const language = await client.query<{ id: string }>(
      "INSERT INTO languages(family_id, name, stage_label) VALUES ($1, $2, $3) RETURNING id",
      [family.rows[0].id, "English", `Modern-${randomUUID()}`]
    );

    await client.query(
      "INSERT INTO words(language_id, text_original, text_normalized, text_ascii_folded, lemma) VALUES ($1, $2, $3, $4, $5)",
      [language.rows[0].id, "father", "father", "father", null]
    );

    await expect(
      client.query(
        "INSERT INTO words(language_id, text_original, text_normalized, text_ascii_folded, lemma) VALUES ($1, $2, $3, $4, $5)",
        [language.rows[0].id, "father", "father", "father", null]
      )
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("supports source attribution join via word_sources", async () => {
    if (!shouldRun || !client) {
      return;
    }

    const family = await client.query<{ id: string }>(
      "INSERT INTO language_families(name, slug) VALUES ($1, $2) RETURNING id",
      ["Germanic", `germanic-${randomUUID()}`]
    );

    const language = await client.query<{ id: string }>(
      "INSERT INTO languages(family_id, name, stage_label) VALUES ($1, $2, $3) RETURNING id",
      [family.rows[0].id, "English", `Old-${randomUUID()}`]
    );

    const word = await client.query<{ id: string }>(
      "INSERT INTO words(language_id, text_original, text_normalized, text_ascii_folded) VALUES ($1, $2, $3, $4) RETURNING id",
      [language.rows[0].id, "faeder", "faeder", "faeder"]
    );

    const source = await client.query<{ id: string }>(
      "INSERT INTO sources(title, author, year) VALUES ($1, $2, $3) RETURNING id",
      [`Fixture Source ${randomUUID()}`, "LexGraph", 2026]
    );

    await client.query(
      "INSERT INTO word_sources(word_id, source_id, source_locator, confidence) VALUES ($1, $2, $3, $4)",
      [word.rows[0].id, source.rows[0].id, "entry-1", 1.0]
    );

    const joined = await client.query<{ total: string }>(
      `
      SELECT COUNT(*)::text AS total
      FROM words w
      JOIN word_sources ws ON ws.word_id = w.id
      JOIN sources s ON s.id = ws.source_id
      WHERE w.id = $1 AND s.id = $2
      `,
      [word.rows[0].id, source.rows[0].id]
    );

    expect(Number(joined.rows[0].total)).toBe(1);
  });
});
