import { Client } from "pg";

interface IntegrityCheck {
  name: string;
  sql: string;
  maxAllowed: number;
}

function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "postgresql://lexgraph:lexgraph@localhost:5433/lexgraph";
}

async function run() {
  const client = new Client({ connectionString: getDatabaseUrl() });
  await client.connect();

  const checks: IntegrityCheck[] = [
    {
      name: "orphan_edges_from_word",
      sql: `
        SELECT COUNT(*)::int AS total
        FROM etymology_edges e
        LEFT JOIN words w ON w.id = e.from_word_id
        WHERE w.id IS NULL
      `,
      maxAllowed: 0
    },
    {
      name: "orphan_edges_to_word",
      sql: `
        SELECT COUNT(*)::int AS total
        FROM etymology_edges e
        LEFT JOIN words w ON w.id = e.to_word_id
        WHERE w.id IS NULL
      `,
      maxAllowed: 0
    },
    {
      name: "edges_without_evidence_source",
      sql: `
        SELECT COUNT(*)::int AS total
        FROM etymology_edges e
        WHERE NOT EXISTS (
          SELECT 1 FROM edge_sources es WHERE es.edge_id = e.id
        )
      `,
      maxAllowed: 0
    },
    {
      name: "invalid_edge_confidence",
      sql: `
        SELECT COUNT(*)::int AS total
        FROM etymology_edges
        WHERE confidence < 0 OR confidence > 1
      `,
      maxAllowed: 0
    },
    {
      name: "invalid_word_source_confidence",
      sql: `
        SELECT COUNT(*)::int AS total
        FROM word_sources
        WHERE confidence < 0 OR confidence > 1
      `,
      maxAllowed: 0
    }
  ];

  try {
    const results: Array<{ name: string; total: number; ok: boolean }> = [];

    for (const check of checks) {
      const queryResult = await client.query<{ total: number }>(check.sql);
      const total = Number(queryResult.rows[0]?.total ?? 0);
      const ok = total <= check.maxAllowed;
      results.push({ name: check.name, total, ok });
    }

    for (const result of results) {
      console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}: ${result.total}`);
    }

    const failures = results.filter((result) => !result.ok);
    if (failures.length > 0) {
      throw new Error(`Integrity checks failed: ${failures.map((f) => f.name).join(", ")}`);
    }

    console.log("Integrity checks passed.");
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
