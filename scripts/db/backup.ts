#!/usr/bin/env tsx
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const defaultName = `lexgraph-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`;
  const outputFile = resolve(process.env.BACKUP_FILE ?? `backups/${defaultName}`);
  mkdirSync(dirname(outputFile), { recursive: true });

  const args = [`--dbname=${databaseUrl}`, '--format=custom', `--file=${outputFile}`, '--no-owner'];
  const child = spawn('pg_dump', args, { stdio: 'inherit' });

  child.on('exit', (code) => {
    if (code !== 0) {
      process.exit(code ?? 1);
    }

    console.log(`Backup created at ${outputFile}`);
  });
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
