import { dbPool } from "../src/db/client.js";
import { ImportPipeline } from "../src/import/importer.js";
import { LocalJsonParser } from "../src/import/adapters/local-json.parser.js";

async function main() {
  const client = await dbPool.connect();
  try {
    const latest = await client.query<{ id: string }>(
      `SELECT id FROM import_jobs WHERE status = 'FAILED' ORDER BY created_at DESC LIMIT 1`
    );
    const jobId = latest.rows[0]?.id;
    if (!jobId) {
      console.log("No failed import job found to resume.");
      return;
    }

    const parser = new LocalJsonParser("tests/fixtures/week4-import-dataset.json");
    const pipeline = new ImportPipeline(parser);
    const result = await pipeline.run();
    console.log(JSON.stringify({ resumedJobId: jobId, result }, null, 2));
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
