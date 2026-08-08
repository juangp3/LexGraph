#!/usr/bin/env tsx
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const backupFile = process.env.BACKUP_FILE;
  if (!backupFile) {
    throw new Error('BACKUP_FILE is required');
  }

  const inputFile = resolve(backupFile);
  const args = [`--dbname=${databaseUrl}`, '--clean', '--if-exists', '--no-owner', inputFile];
  const child = spawn('pg_restore', args, { stdio: 'inherit' });

  child.on('exit', (code) => {
    if (code !== 0) {
      process.exit(code ?? 1);
    }

    console.log(`Restore completed from ${inputFile}`);
  });
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
