import { dbPool } from "../src/db/client.js";

async function main() {
  const client = await dbPool.connect();
  try {
    const result = await client.query(
      `
      SELECT id, status, processed_count, accepted_count, rejected_count, upserted_words, upserted_edges, summary, created_at
      FROM import_jobs
      ORDER BY created_at DESC
      LIMIT 5
      `
    );

    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
