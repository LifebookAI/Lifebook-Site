import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set for Postgres (J1).");
}

const pool = new Pool({
  connectionString,
});

/**
 * Simple pooled query helper for J1-related Postgres access.
 */
export async function pgQuery<T = any>(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}
