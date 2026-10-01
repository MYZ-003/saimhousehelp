import { Pool } from "pg";

export type { Pool as SupabasePool, PoolClient } from "pg";

let pool: Pool | null = null;
let connectionString: string | null = null;

/**
 * Return a lazily-created pool for the Supabase database configured for this
 * application. This deliberately does not fall back to DATABASE_URL, which
 * may point at Replit's managed database.
 */
export function getSupabasePool(): Pool | null {
  const configuredUrl = process.env.SUPABASE_DATABASE_URL?.trim();
  if (!configuredUrl) return null;

  if (!pool || connectionString !== configuredUrl) {
    if (pool) void pool.end().catch(() => undefined);
    pool = new Pool({
      connectionString: configuredUrl,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    connectionString = configuredUrl;
  }

  return pool;
}