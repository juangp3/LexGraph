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

Notes:
- The harness runs in Node (requires `tsx` installed; the repository includes `tsx` as a dev dependency).
- Timeline results depend on your machine; use CI or a dedicated runner for stable comparisons.
