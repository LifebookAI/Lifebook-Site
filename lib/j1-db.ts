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

/**
 * Lazily-initialized Postgres pool.
 *
 * This avoids throwing at module load time in environments where DATABASE_URL
 * is not set (e.g. some build steps or non-DB serverless functions). Callers
 * should still gate usage behind their own DATABASE_URL / feature checks.
 */
let pool: PgPool | null = null;

function getPgPool(): PgPool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set for Postgres (J1).");
  }

  if (!pool) {
    // We treat `pg` as an implementation detail and narrow it once into our PgPool interface.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    pool = new Pool({
      connectionString,
    }) as unknown as PgPool;
  }

  return pool;
}

/**
 * Simple pooled query helper for J1-related Postgres access.
 *
 * Callers provide the expected row shape via the generic parameter.
 * This is intended for server-side usage only.
 */
export async function pgQuery<T extends PgRow>(
  text: string,
  params?: PgQueryParams,
): Promise<PgQueryResult<T>> {
  const client = await getPgPool().connect();

  try {
    const result = await client.query<T>(text, params ?? []);
    return result;
  } finally {
    client.release();
  }
}