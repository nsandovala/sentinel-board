import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __sentinelPgPool: Pool | undefined;
}

function getDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required. Configure Postgres before starting Sentinel Board.");
  }
  return value;
}

function shouldUseSsl(connectionString: string) {
  return (
    connectionString.includes("sslmode=require") ||
    connectionString.includes("neon.tech") ||
    process.env.PGSSL === "true"
  );
}

const connectionString = getDatabaseUrl();
const pool =
  globalThis.__sentinelPgPool ??
  new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PG_POOL_MAX ?? "10"),
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__sentinelPgPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool };
