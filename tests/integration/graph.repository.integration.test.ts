import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { PgGraphRepository } from "../../src/repositories/pg-graph.repository.js";

const shouldRun = process.env.RUN_INTEGRATION === "true";
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://lexgraph:lexgraph@localhost:5433/lexgraph";

let client: Client | null = null;

describe("integration: graph repository", () => {
  const repository = new PgGraphRepository();

  let rootWordId = "";
  let ancestorWordId = "";
  let protoWordId = "";
  let sourceId = "";

  beforeAll(async () => {
    if (!shouldRun) {
      return;
    }

    client = new Client({ connectionString });
    await client.connect();

    const family = await client.query<{ id: string }>(
      "INSERT INTO language_families(name, slug) VALUES ($1, $2) RETURNING id",
      ["Indo-European", `indo-european-${randomUUID()}`]
    );

    const language = await client.query<{ id: string }>(
      "INSERT INTO languages(family_id, name, stage_label) VALUES ($1, $2, $3) RETURNING id",
      [family.rows[0].id, "English", `Week3-${randomUUID()}`]
    );

    const rootWord = await client.query<{ id: string }>(
      "INSERT INTO words(language_id, text_original, text_normalized, text_ascii_folded) VALUES ($1, $2, $3, $4) RETURNING id",
      [language.rows[0].id, "father", "father", "father"]
    );

    const ancestorWord = await client.query<{ id: string }>(
      "INSERT INTO words(language_id, text_original, text_normalized, text_ascii_folded) VALUES ($1, $2, $3, $4) RETURNING id",
      [language.rows[0].id, "faeder", "faeder", "faeder"]
    );

    const protoWord = await client.query<{ id: string }>(
      "INSERT INTO words(language_id, text_original, text_normalized, text_ascii_folded, is_reconstructed) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [language.rows[0].id, "*fader", "*fader", "*fader", true]
    );

    const source = await client.query<{ id: string }>(
      "INSERT INTO sources(title, author, year, citation) VALUES ($1, $2, $3, $4) RETURNING id",
      ["Week 3 Provenance", "LexGraph", 2026, "fixture"]
    );

    rootWordId = rootWord.rows[0].id;
    ancestorWordId = ancestorWord.rows[0].id;
    protoWordId = protoWord.rows[0].id;
    sourceId = source.rows[0].id;

    await repository.upsertEdge({
      fromWordId: rootWordId,
      toWordId: ancestorWordId,
      relationType: "EVOLVED_FROM",
      confidence: 0.95,
      method: "manual",
      evidenceSummary: "Direct etymological source",
      sources: [{
        sourceId,
        sourceLocator: "entry-1",
        quoteExcerpt: "father from faeder"
      }]
    });

    await repository.upsertEdge({
      fromWordId: ancestorWordId,
      toWordId: protoWordId,
      relationType: "EVOLVED_FROM",
      confidence: 0.90,
      method: "imported",
      evidenceSummary: "Historical reconstruction",
      sources: [{
        sourceId,
        sourceLocator: "entry-2",
        quoteExcerpt: "faeder from *fader"
      }]
    });

    // Add a cycle to assert traversal guards do not recurse forever.
    await repository.upsertEdge({
      fromWordId: protoWordId,
      toWordId: rootWordId,
      relationType: "COGNATE_WITH",
      confidence: 0.4,
      method: "inferred",
      sources: [{
        sourceId,
        sourceLocator: "entry-3",
        quoteExcerpt: "cognate linkage fixture"
      }]
    });
  });

  afterAll(async () => {
    if (!shouldRun || !client) {
      return;
    }

    await client.query(
      `
      DELETE FROM languages
      WHERE stage_label LIKE 'Week3-%'
      `
    );

    await client.end();
  });

  it("returns ordered ancestor traversal with provenance", async () => {
    if (!shouldRun) {
      expect(true).toBe(true);
      return;
    }

    const edges = await repository.findAncestors(rootWordId, 4);

    expect(edges.length).toBeGreaterThanOrEqual(2);
    expect(edges[0].depth).toBe(1);
    expect(edges[0].relationType).toBe("EVOLVED_FROM");
    expect(edges[0].sources.length).toBeGreaterThanOrEqual(1);
    expect(edges[0].sources[0].sourceId).toBe(sourceId);

    const depths = edges.map((edge) => edge.depth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });

  it("prevents path cycles while traversing", async () => {
    if (!shouldRun) {
      expect(true).toBe(true);
      return;
    }

    const edges = await repository.findAncestors(rootWordId, 6);

    for (const edge of edges) {
      const uniquePathNodes = new Set(edge.path);
      expect(uniquePathNodes.size).toBe(edge.path.length);
    }
  });

  it("filters specialized traversals by relation type", async () => {
    if (!shouldRun) {
      expect(true).toBe(true);
      return;
    }

    const cognates = await repository.findCognates(rootWordId, 6);
    const borrowings = await repository.findBorrowings(rootWordId, 6);

    expect(cognates.every((edge) => edge.relationType === "COGNATE_WITH")).toBe(true);
    expect(borrowings.length).toBe(0);
  });
});
