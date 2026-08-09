import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface SearchBenchmarkCase {
  id: string;
  query: string;
  expectedTop1?: string;
  expectedTop5?: string[];
  acceptableResults?: string[];
  category?: string;
}

export interface SearchBenchmarkEvaluation {
  precisionAt1: number;
  precisionAt5: number;
  rankedResults: Array<{ wordId: string; textOriginal: string; score: number; matchType: string }>;
}

export async function loadSearchBenchmarkCases(): Promise<SearchBenchmarkCase[]> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const benchmarkPath = path.resolve(currentDir, "../../tests/search/benchmark.json");
  const data = await readFile(benchmarkPath, "utf8");
  return JSON.parse(data) as SearchBenchmarkCase[];
}

export function evaluateSearchBenchmarkCase(
  results: Array<{ wordId: string; textOriginal: string; score: number; matchType: string }>,
  benchmarkCase: SearchBenchmarkCase,
): SearchBenchmarkEvaluation {
  const top1 = results[0]?.wordId;
  const top5 = results.slice(0, 5).map((result) => result.wordId);

  const expectedTop1 = benchmarkCase.expectedTop1;
  const expectedTop5 = benchmarkCase.expectedTop5 ?? [];
  const acceptableResults = benchmarkCase.acceptableResults ?? [];

  const precisionAt1 = expectedTop1 ? (top1 === expectedTop1 ? 1 : 0) : 0;
  const precisionAt5 = expectedTop5.length > 0
    ? (top5.some((id) => expectedTop5.includes(id)) ? 1 : 0)
    : acceptableResults.length > 0
      ? (top5.some((id) => acceptableResults.includes(id)) ? 1 : 0)
      : 0;

  return { precisionAt1, precisionAt5, rankedResults: results };
}
