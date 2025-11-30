import { Pool } from "pg";

export type PgRow = Record<string, unknown>;
export type PgQueryResult<T extends PgRow> = { rows: T[] };
export type PgQueryParams = readonly unknown[];

type PgClient = {
  query<T extends PgRow>(
    text: string,
    params?: PgQueryParams,
  ): Promise<PgQueryResult<T>>;
  release(): void;
};

type PgPool = {
  connect(): Promise<PgClient>;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set for Postgres (J1).");
}

// We treat `pg` as an implementation detail and narrow it once into our PgPool interface.
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const pool: PgPool = new Pool({
  connectionString,
}) as unknown as PgPool;

/**
 * Simple pooled query helper for J1-related Postgres access.
 *
 * Callers provide the expected row shape via the generic parameter.
 */
export async function pgQuery<T extends PgRow>(
  text: string,
  params?: PgQueryParams,
): Promise<PgQueryResult<T>> {
  const client = await pool.connect();

  try {
    const result = await client.query<T>(text, params ?? []);
    return result;
  } finally {
    client.release();
  }
}
