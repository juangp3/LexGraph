#!/usr/bin/env tsx
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

interface BenchResult {
  endpoint: string;
  p95Ms: number;
}

interface BenchPayload {
  results: BenchResult[];
}

interface FullBenchResult {
  timestamp: string;
  baseUrl: string;
  results: Array<{
    endpoint: string;
    iterations: number;
    statusCodes: number[];
    durationsMs: number[];
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  }>;
}

export function parseBenchJson(output: string): BenchPayload {
  const marker = 'API_BENCH_JSON:';
  const line = output.split('\n').find((entry) => entry.startsWith(marker));
  if (!line) {
    throw new Error('API benchmark JSON marker not found in output');
  }

  const payload = JSON.parse(line.slice(marker.length)) as FullBenchResult;
  return {
    results: payload.results.map(({ endpoint, p95Ms }) => ({ endpoint, p95Ms })),
  };
}

function toMap(payload: BenchPayload): Map<string, number> {
  return new Map(payload.results.map((entry) => [entry.endpoint, entry.p95Ms]));
}

function runBenchScript(): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [resolvePath('node_modules/tsx/dist/cli.mjs'), 'scripts/perf/run-api-bench.ts'], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: resolvePath('.'),
    }) as ReturnType<typeof spawn>;

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer | string) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr?.on('data', (chunk: Buffer | string) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });

    child.on('exit', (code: number | null) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`Benchmark script failed with code ${code}. ${stderr}`));
    });
  });
}

async function run() {
  const baselinePath = process.env.PERF_BASELINE_PATH ?? 'tests/performance/baseline-api.json';
  const maxRegressionPct = Number(process.env.MAX_REGRESSION_PCT ?? 15);
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as BenchPayload;

  const output = await runBenchScript();
  const current = parseBenchJson(output);

  const baselineMap = toMap(baseline);
  const currentMap = toMap(current);

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

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
