#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';

interface BenchResult {
  endpoint: string;
  p95Ms: number;
}

interface BenchPayload {
  results: BenchResult[];
}

function parseBenchFromEnv(envVar: string): BenchPayload {
  const raw = process.env[envVar];
  if (!raw) {
    throw new Error(`${envVar} is required`);
  }

  return JSON.parse(raw) as BenchPayload;
}

function toMap(payload: BenchPayload): Map<string, number> {
  return new Map(payload.results.map((entry) => [entry.endpoint, entry.p95Ms]));
}

function run() {
  const baselinePath = process.env.PERF_BASELINE_PATH ?? 'tests/performance/baseline-api.json';
  const maxRegressionPct = Number(process.env.MAX_REGRESSION_PCT ?? 15);

  const current = parseBenchFromEnv('CURRENT_BENCH_JSON');
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as BenchPayload;

  const currentMap = toMap(current);
  const baselineMap = toMap(baseline);

  const failures: string[] = [];

  for (const [endpoint, baselineP95] of baselineMap.entries()) {
    const currentP95 = currentMap.get(endpoint);
    if (typeof currentP95 !== 'number') {
      failures.push(`Missing endpoint in current run: ${endpoint}`);
      continue;
    }

    const deltaPct = ((currentP95 - baselineP95) / baselineP95) * 100;
    if (deltaPct > maxRegressionPct) {
      failures.push(
        `${endpoint} regressed by ${deltaPct.toFixed(2)}% (baseline p95=${baselineP95}ms, current p95=${currentP95}ms, max=${maxRegressionPct}%)`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('Performance regression check failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Performance regression check passed.');
}

run();
