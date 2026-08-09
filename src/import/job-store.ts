import { createHash, randomUUID } from "node:crypto";

export interface RawRecordStoreClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: Array<T> }>;
}

export interface RawRecordReference {
  payload: Record<string, unknown>;
  sourceKey: string;
}

export interface ImportJobStore {
  getLatestImportJob(client: RawRecordStoreClient): Promise<Record<string, unknown> | null>;
  getRecentImportFailures(client: RawRecordStoreClient, limit?: number): Promise<Array<Record<string, unknown>>>;
  getImportJobDetails(client: RawRecordStoreClient, jobId: string): Promise<Record<string, unknown> | null>;
  getImportJobRawRecords(client: RawRecordStoreClient, jobId: string, limit?: number): Promise<Array<Record<string, unknown>>>;
}

export function getPendingRecords(records: RawRecordReference[], seenHashes: Set<string>): RawRecordReference[] {
  return records.filter((record) => {
    const hash = createHash("sha256").update(JSON.stringify(record.payload)).digest("hex");
    return !seenHashes.has(hash);
  });
}

export function getImportSummary(job: { processedCount: number; acceptedCount: number; rejectedCount: number; upsertedWords: number; upsertedEdges: number; status: string }) {
  return {
    status: job.status,
    processedCount: job.processedCount,
    acceptedCount: job.acceptedCount,
    rejectedCount: job.rejectedCount,
    upsertedWords: job.upsertedWords,
    upsertedEdges: job.upsertedEdges
  };
}

export async function getLatestImportJob(client: RawRecordStoreClient) {
  const result = await client.query(
    `
    SELECT id, status, processed_count, accepted_count, rejected_count, upserted_words, upserted_edges, rejection_log_path, summary
    FROM import_jobs
    ORDER BY created_at DESC
    LIMIT 1
    `
  );

  return (result as { rows: Array<Record<string, unknown>> }).rows[0] ?? null;
}

export async function getImportJobDetails(client: RawRecordStoreClient, jobId: string) {
  const result = await client.query(
    `
    SELECT id, source_name, status, rejection_log_path, processed_count, accepted_count, rejected_count, upserted_words, upserted_edges, summary, started_at, completed_at, created_at, updated_at
    FROM import_jobs
    WHERE id = $1
    LIMIT 1
    `,
    [jobId]
  );

  return (result as { rows: Array<Record<string, unknown>> }).rows[0] ?? null;
}

export async function getImportJobRawRecords(client: RawRecordStoreClient, jobId: string, limit = 50) {
  const result = await client.query(
    `
    SELECT id, source_key, source_hash, payload, created_at
    FROM raw_import_records
    WHERE job_id = $1
    ORDER BY created_at ASC
    LIMIT $2
    `,
    [jobId, limit]
  );

  return (result as { rows: Array<Record<string, unknown>> }).rows;
}

export async function getRecentImportFailures(client: RawRecordStoreClient, limit = 5) {
  const result = await client.query(
    `
    SELECT id, status, summary, created_at
    FROM import_jobs
    WHERE status = 'FAILED'
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [limit]
  );

  return (result as { rows: Array<Record<string, unknown>> }).rows;
}

export async function persistRawRecords(
  client: RawRecordStoreClient,
  jobId: string,
  records: Array<{ payload: Record<string, unknown>; sourceKey: string }>
): Promise<number> {
  let persisted = 0;

  for (const record of records) {
    const payload = JSON.stringify(record.payload);
    const sourceHash = createHash("sha256").update(payload).digest("hex");

    const existing = await client.query<{ id: string }>(
      `
      SELECT id FROM raw_import_records
      WHERE job_id = $1 AND source_hash = $2
      LIMIT 1
      `,
      [jobId, sourceHash]
    );

    const existingRows = Array.isArray((existing as { rows?: Array<{ id: string }> }).rows)
      ? (existing as { rows?: Array<{ id: string }> }).rows ?? []
      : [];

    if (existingRows.length > 0) {
      continue;
    }

    await client.query(
      `
      INSERT INTO raw_import_records (id, job_id, source_key, source_hash, payload)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [randomUUID(), jobId, record.sourceKey, sourceHash, payload]
    );
    persisted += 1;
  }

  return persisted;
}
