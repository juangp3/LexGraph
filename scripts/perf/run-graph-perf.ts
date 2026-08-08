#!/usr/bin/env tsx
import { performance } from 'perf_hooks';
import { generateLargeFlow } from './generate-large-flow';
import { mergeFlowGraphs } from '../../web/src/features/graph/graph.service';

interface GraphPerfResult {
  totalNodes: number;
  durationMs: number;
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return Number(sorted[index].toFixed(2));
}

async function run() {
  const sizes = [100, 500, 1000, 2000];
  const results: GraphPerfResult[] = [];

  for (const size of sizes) {
    const graphs = [];
    // create a few subgraphs to merge
    for (let i = 0; i < 3; i++) {
      graphs.push(generateLargeFlow(size / 3));
    }

    const t0 = performance.now();
    const merged = mergeFlowGraphs(graphs as any);
    const t1 = performance.now();
    const durationMs = Number((t1 - t0).toFixed(2));
    results.push({ totalNodes: merged.nodes.length, durationMs });
    console.log(`Merged ${graphs.length} graphs ~ total nodes ${merged.nodes.length} in ${durationMs.toFixed(2)}ms`);
  }

  const durations = results.map((result) => result.durationMs);
  const summary = {
    timestamp: new Date().toISOString(),
    graphLayoutBench: {
      runs: results,
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      p99Ms: percentile(durations, 0.99),
    },
  };

  console.log(`PERF_SUMMARY:${JSON.stringify(summary)}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
