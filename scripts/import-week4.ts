import { LocalJsonParser } from "../src/import/adapters/local-json.parser.js";
import { ImportPipeline } from "../src/import/importer.js";

async function main() {
  const parser = new LocalJsonParser("tests/fixtures/week4-import-dataset.json");
  const pipeline = new ImportPipeline(parser);

  const result = await pipeline.run();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
