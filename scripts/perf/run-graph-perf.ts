#!/usr/bin/env tsx
import { performance } from 'perf_hooks';
import { generateLargeFlow } from './generate-large-flow';
import { mergeFlowGraphs } from '../web/src/features/graph/graph.service';

async function run() {
  const sizes = [100, 500, 1000, 2000];
  for (const size of sizes) {
    const graphs = [];
    // create a few subgraphs to merge
    for (let i = 0; i < 3; i++) {
      graphs.push(generateLargeFlow(size / 3));
    }

    const t0 = performance.now();
    const merged = mergeFlowGraphs(graphs as any);
    const t1 = performance.now();
    console.log(`Merged ${graphs.length} graphs ~ total nodes ${merged.nodes.length} in ${(t1 - t0).toFixed(2)}ms`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
