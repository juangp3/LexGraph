import { describe, expect, it } from "vitest";
import { parseBenchJson } from "../../scripts/perf/run-ci-perf.js";

describe("perf CI wrapper", () => {
  it("parses the current benchmark payload shape emitted by the benchmark script", () => {
    const output = `API_BENCH_JSON:${JSON.stringify({
      timestamp: "2026-08-09T00:00:00.000Z",
      baseUrl: "http://localhost:3001",
      results: [
        {
          endpoint: "/v1/search?q=father",
          iterations: 20,
          statusCodes: [200],
          durationsMs: [12],
          p50Ms: 12,
          p95Ms: 14,
          p99Ms: 15,
        },
      ],
    })}`;

    const parsed = parseBenchJson(output);

    expect(parsed.results).toEqual([
      { endpoint: "/v1/search?q=father", p95Ms: 14 },
    ]);
  });
});
