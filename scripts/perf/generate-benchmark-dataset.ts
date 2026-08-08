#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

interface BenchmarkWord {
  text: string;
  language: string;
  partOfSpeech: 'noun';
  meaning: string;
  relationships: Array<{ type: 'EVOLVED_FROM' | 'COGNATE_WITH'; target: string; confidence: number }>;
}

function makeWord(index: number): BenchmarkWord {
  const text = `word_${index}`;
  const previous = index > 1 ? `word_${index - 1}` : null;

  const relationships: BenchmarkWord['relationships'] = [];
  if (previous) {
    relationships.push({ type: 'EVOLVED_FROM', target: previous, confidence: 0.92 });
  }
  if (index > 10 && index % 5 === 0) {
    relationships.push({ type: 'COGNATE_WITH', target: `word_${index - 10}`, confidence: 0.78 });
  }

  return {
    text,
    language: index % 2 === 0 ? 'English' : 'Latin',
    partOfSpeech: 'noun',
    meaning: `Synthetic benchmark term #${index}`,
    relationships,
  };
}

function run() {
  const count = Number(process.env.BENCH_DATASET_WORDS ?? 5000);
  const output = resolve(process.env.BENCH_DATASET_FILE ?? `tests/fixtures/benchmark-seed-${count}.json`);
  mkdirSync(dirname(output), { recursive: true });

  const words: BenchmarkWord[] = [];
  for (let i = 1; i <= count; i += 1) {
    words.push(makeWord(i));
  }

  const payload = {
    metadata: {
      generatedAt: new Date().toISOString(),
      kind: 'benchmark-synthetic',
      wordCount: count,
    },
    words,
  };

  writeFileSync(output, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Benchmark dataset generated: ${output} (${count} words)`);
}

run();
