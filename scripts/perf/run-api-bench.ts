#!/usr/bin/env tsx
import { performance } from 'node:perf_hooks';

interface BenchResult {
  endpoint: string;
  iterations: number;
  statusCodes: number[];
  durationsMs: number[];
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

interface FullBenchResult {
  timestamp: string;
  baseUrl: string;
  results: BenchResult[];
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return Number(sorted[index].toFixed(2));
}

async function timeRequest(url: string): Promise<{ status: number; durationMs: number }> {
  const startedAt = performance.now();
  const response = await fetch(url);
  const durationMs = Number((performance.now() - startedAt).toFixed(2));
  return { status: response.status, durationMs };
}

async function benchmarkEndpoint(baseUrl: string, endpoint: string, iterations: number): Promise<BenchResult> {
  const durationsMs: number[] = [];
  const statusCodes: number[] = [];

  for (let i = 0; i < iterations; i += 1) {
    const result = await timeRequest(`${baseUrl}${endpoint}`);
    durationsMs.push(result.durationMs);
    statusCodes.push(result.status);
  }

  return {
    endpoint,
    iterations,
    statusCodes,
    durationsMs,
    p50Ms: percentile(durationsMs, 0.5),
    p95Ms: percentile(durationsMs, 0.95),
    p99Ms: percentile(durationsMs, 0.99),
  };
}

async function run() {
  const baseUrl = process.env.BENCH_BASE_URL ?? 'http://localhost:3001';
  const iterations = Number(process.env.BENCH_ITERATIONS ?? 20);
  const graphEntityId = process.env.BENCH_GRAPH_ENTITY_ID ?? '11111111-1111-1111-8111-111111111111';
  const wordId = process.env.BENCH_WORD_ID ?? graphEntityId;

  const endpoints = [
    '/health',
    '/v1/search?q=father',
    `/v1/words/${wordId}`,
    `/v1/graph/${graphEntityId}/expand?direction=ancestors&depth=2&limit=25`,
    `/v1/graph/${graphEntityId}/expand?direction=ancestors&depth=3&limit=50`,
  ];

  const results: BenchResult[] = [];
  for (const endpoint of endpoints) {
    const bench = await benchmarkEndpoint(baseUrl, endpoint, iterations);
    results.push(bench);
    console.log(`[bench] ${endpoint} p50=${bench.p50Ms} p95=${bench.p95Ms} p99=${bench.p99Ms}`);
  }

  const payload: FullBenchResult = {
    timestamp: new Date().toISOString(),
    baseUrl,
    results,
  };

  console.log(`API_BENCH_JSON:${JSON.stringify(payload)}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
