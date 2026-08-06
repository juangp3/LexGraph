import type { FlowGraph } from '../web/src/features/graph/graph.service';

export function generateLargeFlow(nodeCount: number, edgesPerNode = 2): FlowGraph {
  const nodes = [] as any[];
  const edges = [] as any[];

  for (let i = 0; i < nodeCount; i++) {
    nodes.push({ id: `n${i}`, data: { label: `node-${i}` }, position: { x: (i % 50) * 40, y: Math.floor(i / 50) * 80 } });
  }

  for (let i = 0; i < nodeCount; i++) {
    for (let k = 1; k <= edgesPerNode; k++) {
      const target = (i + k) % nodeCount;
      edges.push({ id: `e${i}-${k}`, source: `n${i}`, target: `n${target}`, data: { relationType: 'derived' } });
    }
  }

  return { nodes, edges };
}
