import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { LocalJsonParser } from "../../src/import/adapters/local-json.parser.js";
import { ImportPipeline } from "../../src/import/importer.js";

const shouldRun = process.env.RUN_INTEGRATION === "true";
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://lexgraph:lexgraph@localhost:5433/lexgraph";

let client: Client | null = null;

describe("integration: import pipeline", () => {
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

  it("imports idempotently and logs rejected records", async () => {
    if (!shouldRun || !client) {
      expect(true).toBe(true);
      return;
    }

    const parser = new LocalJsonParser("tests/fixtures/week4-import-dataset.json");
    const pipeline = new ImportPipeline(parser);

    const firstRun = await pipeline.run("logs/import-week4-test.ndjson");
    const secondRun = await pipeline.run("logs/import-week4-test.ndjson");

    expect(firstRun.processed).toBeGreaterThan(0);
    expect(firstRun.rejected).toBeGreaterThanOrEqual(2);

    const wordsCount = await client.query<{ total: string }>(
      `
      SELECT COUNT(DISTINCT w.id)::text AS total
      FROM words w
      JOIN word_sources ws ON ws.word_id = w.id
      JOIN sources s ON s.id = ws.source_id
      WHERE s.title = 'Week4 Fixture Import Source'
      `
    );

    const edgeCount = await client.query<{ total: string }>(
      `
      SELECT COUNT(DISTINCT e.id)::text AS total
      FROM etymology_edges e
      JOIN edge_sources es ON es.edge_id = e.id
      JOIN sources s ON s.id = es.source_id
      WHERE s.title = 'Week4 Fixture Import Source'
      `
    );

    expect(Number(wordsCount.rows[0].total)).toBe(3);
    expect(Number(edgeCount.rows[0].total)).toBe(2);
    expect(secondRun.accepted).toBe(firstRun.accepted);

    const rejectionLog = readFileSync(resolve("logs/import-week4-test.ndjson"), "utf8");
    expect(rejectionLog).toContain("REQUIRED_FIELD_MISSING");
    expect(rejectionLog).toContain("INVALID_RELATION_TYPE");
  });

  it("imports the seed-v2 fixture into searchable words", async () => {
    if (!shouldRun || !client) {
      expect(true).toBe(true);
      return;
    }

    const parser = new LocalJsonParser("tests/fixtures/seed-v2.json");
    const pipeline = new ImportPipeline(parser);

    const runResult = await pipeline.run("logs/import-seed-v2.ndjson");

    expect(runResult.accepted).toBeGreaterThan(0);
    expect(runResult.upsertedWords).toBeGreaterThan(0);

    const wordsCount = await client.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM words`
    );

    expect(Number(wordsCount.rows[0].total)).toBeGreaterThan(0);
  });
});
