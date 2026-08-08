Performance test harness

This folder contains a simple performance harness to measure the cost of merging large FlowGraphs and running Dagre layout.

Usage:

From the repository root run:

```bash
npm run perf:graph
```

This will execute `scripts/perf/run-graph-perf.ts` which:
- Generates synthetic FlowGraph objects of various sizes
- Calls `mergeFlowGraphs` (which applies Dagre layout)
- Prints timing for each size

Additional commands:

```bash
npm run perf:api
npm run perf:ci
npm run perf:dataset
```

- `perf:api` executes endpoint benchmarks and prints p50/p95/p99 for health, search, word lookup, and graph traversal.
- `perf:ci` runs the API benchmark and enforces regression thresholds against `tests/performance/baseline-api.json`.
- `perf:dataset` generates a synthetic production-like benchmark dataset fixture.

Notes:
- The harness runs in Node (requires `tsx` installed; the repository includes `tsx` as a dev dependency).
- Timeline results depend on your machine; use CI or a dedicated runner for stable comparisons.
