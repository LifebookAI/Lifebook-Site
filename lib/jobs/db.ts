import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __lifebookPgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __lifebookJobsSchemaEnsured: boolean | undefined;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

export function getPgPool(): Pool {
  if (!globalThis.__lifebookPgPool) {
    globalThis.__lifebookPgPool = new Pool({
      connectionString: requireEnv("DATABASE_URL"),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalThis.__lifebookPgPool;
}

/**
 * DEV-safety schema ensure (idempotent). Migration is source-of-truth,
 * but this prevents local foot-guns when DB is fresh.
 */
export async function ensureJobsSchema(): Promise<void> {
  if (globalThis.__lifebookJobsSchemaEnsured) return;

  const pool = getPgPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id             TEXT PRIMARY KEY,
      workspace_id    TEXT NOT NULL,
      kind           TEXT NOT NULL,
      trigger_type    TEXT NOT NULL DEFAULT 'manual',
      template_id     TEXT NULL,
      idempotency_key TEXT NULL,
      status          TEXT NOT NULL,
      attempt         INTEGER NOT NULL DEFAULT 0,
      job_json        JSONB NOT NULL,
      last_error      TEXT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at      TIMESTAMPTZ NULL,
      finished_at     TIMESTAMPTZ NULL
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_ws_created_idx ON jobs(workspace_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_ws_status_idx  ON jobs(workspace_id, status);`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS jobs_ws_idem_uniq
      ON jobs(workspace_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS run_logs (
      id        BIGSERIAL PRIMARY KEY,
      job_id    TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      level     TEXT NOT NULL,
      msg       TEXT NOT NULL,
      meta_json JSONB NULL
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS run_logs_job_ts_idx ON run_logs(job_id, ts DESC);`);

  globalThis.__lifebookJobsSchemaEnsured = true;
}