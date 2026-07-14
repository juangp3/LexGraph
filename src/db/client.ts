import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://lexgraph:lexgraph@localhost:5433/lexgraph";

export const dbPool = new Pool({ connectionString });
