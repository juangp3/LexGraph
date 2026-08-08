#!/usr/bin/env tsx
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { Client } from 'pg';

function withDatabase(connectionString: string, database: string): string {
  const parsed = new URL(connectionString);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${command} failed with exit code ${code}`));
    });
  });
}

async function createBackupIfMissing(databaseUrl: string): Promise<string> {
  const explicitBackupFile = process.env.BACKUP_FILE;
  if (explicitBackupFile) {
    return resolve(explicitBackupFile);
  }

  const generatedPath = resolve(`backups/restore-drill-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
  mkdirSync(dirname(generatedPath), { recursive: true });
  await runCommand('pg_dump', [`--dbname=${databaseUrl}`, '--format=custom', `--file=${generatedPath}`, '--no-owner']);
  return generatedPath;
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const backupFile = await createBackupIfMissing(databaseUrl);
  const adminDb = process.env.PG_ADMIN_DB ?? 'postgres';
  const adminUrl = withDatabase(databaseUrl, adminDb);
  const restoreDbName = `lexgraph_restore_drill_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const restoreDbUrl = withDatabase(databaseUrl, restoreDbName);

  const adminClient = new Client({ connectionString: adminUrl });

  try {
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE "${restoreDbName}"`);

    await runCommand('pg_restore', [
      `--dbname=${restoreDbUrl}`,
      '--clean',
      '--if-exists',
      '--no-owner',
      backupFile,
    ]);

    const restoreClient = new Client({ connectionString: restoreDbUrl });
    try {
      await restoreClient.connect();
      await restoreClient.query('SELECT 1');
      await restoreClient.query('SELECT COUNT(*) FROM "_prisma_migrations"');
    } finally {
      await restoreClient.end();
    }

    console.log(`Restore drill succeeded using backup ${backupFile}`);
  } finally {
    try {
      await adminClient.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [restoreDbName],
      );
      await adminClient.query(`DROP DATABASE IF EXISTS "${restoreDbName}"`);
    } catch (cleanupError) {
      console.error('Failed to cleanup restore drill database', cleanupError);
    }

    await adminClient.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
