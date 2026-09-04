import "server-only";

import { Pool, type PoolConfig } from "pg";

const globalForDatabase = globalThis as typeof globalThis & {
  contentDockDatabasePool?: Pool;
};

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createPool() {
  const config: PoolConfig = {
    application_name: "contentdock",
    max: positiveInteger(process.env.DATABASE_POOL_MAX, 10),
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  };

  if (process.env.DATABASE_URL) {
    config.connectionString = process.env.DATABASE_URL;
  }

  return new Pool(config);
}

export function getDatabasePool() {
  globalForDatabase.contentDockDatabasePool ??= createPool();
  return globalForDatabase.contentDockDatabasePool;
}

export async function checkDatabaseConnection() {
  const result = await getDatabasePool().query<{ database: string; checked_at: Date }>(
    "select current_database() as database, now() as checked_at",
  );
  return result.rows[0];
}
