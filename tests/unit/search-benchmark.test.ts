import { describe, expect, it } from "vitest";
import { searchCacheKey } from "../../src/cache/keys.js";
import { evaluateSearchBenchmarkCase, loadSearchBenchmarkCases } from "../../src/search/benchmark.js";

describe("search benchmark evaluation", () => {
  it("loads the benchmark dataset and evaluates a simple exact-match case", async () => {
    const cases = await loadSearchBenchmarkCases();
    expect(cases.length).toBeGreaterThan(0);

    const result = evaluateSearchBenchmarkCase(
      [
        { wordId: "father", textOriginal: "father", textNormalized: "father", score: 1, matchType: "exact" },
      ] as never,
      cases[0],
    );

    expect(result.precisionAt1).toBe(1);
    expect(result.precisionAt5).toBe(1);
  });

  it("includes the dataset version in the cache key", () => {
    const key = searchCacheKey({ query: "father", datasetVersion: "2026-08", limit: 10 });
    expect(key).toContain("2026-08");
  });
});
