import { Client } from "pg";

function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "postgresql://lexgraph:lexgraph@localhost:5433/lexgraph";
}

async function main() {
  const client = new Client({ connectionString: getDatabaseUrl() });
  await client.connect();

  try {
    const result = await client.query(
      `
      SELECT w.id, w.text_original, w.text_normalized, l.name AS language
      FROM words w
      LEFT JOIN languages l ON l.id = w.language_id
      ORDER BY w.created_at ASC
      LIMIT 1000
      `
    );

    if (result.rows.length === 0) {
      console.log("No words found in the database.");
      return;
    }

    for (const row of result.rows) {
      console.log(`${row.id}\t${row.text_original}\t${row.text_normalized}\t${row.language}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
