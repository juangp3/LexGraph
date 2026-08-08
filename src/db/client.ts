import { performance } from "node:perf_hooks";
import { Pool, type PoolClient } from "pg";
import { metrics } from "../observability/metrics.js";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://lexgraph:lexgraph@localhost:5433/lexgraph";

export const dbPool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX ?? 20),
  min: Number(process.env.DB_POOL_MIN ?? 2),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 5000),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30_000),
  query_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS ?? 2000),
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 5000),
});

const originalPoolQuery = dbPool.query.bind(dbPool);
const instrumentedPool = dbPool as Pool & Record<string, unknown>;

instrumentedPool.query = (async (...args: Parameters<typeof dbPool.query>) => {
  const startedAt = performance.now();

  try {
    const result = await originalPoolQuery(...args);
    metrics.recordDatabaseQuery({ durationMs: performance.now() - startedAt, success: true });
    return result;
  } catch (error) {
    metrics.recordDatabaseQuery({ durationMs: performance.now() - startedAt, success: false });
    throw error;
  }
}) as typeof dbPool.query;

const originalConnect = dbPool.connect.bind(dbPool) as () => Promise<PoolClient>;

instrumentedPool.connect = (async () => {
  const client = await originalConnect();
  const originalClientQuery = client.query.bind(client);

  client.query = (async (...queryArgs: Parameters<typeof client.query>) => {
    const startedAt = performance.now();

    try {
      const result = await originalClientQuery(...queryArgs);
      metrics.recordDatabaseQuery({ durationMs: performance.now() - startedAt, success: true });
      return result;
    } catch (error) {
      metrics.recordDatabaseQuery({ durationMs: performance.now() - startedAt, success: false });
      throw error;
    }
  }) as typeof client.query;

  return client;
}) as typeof dbPool.connect;
