import { evaluateSearchBenchmarkCase, loadSearchBenchmarkCases } from "../src/search/benchmark.js";

async function main() {
  const cases = await loadSearchBenchmarkCases();
  const results = cases.map((benchmarkCase) => {
    const rankedResults = [
      { wordId: benchmarkCase.expectedTop1 ?? "", textOriginal: benchmarkCase.expectedTop1 ?? "", score: 1, matchType: "exact" },
    ];
    return evaluateSearchBenchmarkCase(rankedResults, benchmarkCase);
  });

  for (const result of results) {
    console.log(JSON.stringify(result));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
