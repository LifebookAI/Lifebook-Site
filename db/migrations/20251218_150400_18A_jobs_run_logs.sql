-- Phase 4 / 18A — Minimal persistent orchestration schema (FD-9 alignment)
-- Canonical tables: jobs, run_logs
CREATE TABLE IF NOT EXISTS jobs (
  id               TEXT PRIMARY KEY,
  workspace_id      TEXT NOT NULL,
  kind             TEXT NOT NULL,
  trigger_type      TEXT NOT NULL DEFAULT 'manual',
  template_id       TEXT NULL,
  idempotency_key   TEXT NULL,
  status            TEXT NOT NULL,
  attempt           INTEGER NOT NULL DEFAULT 0,
  job_json          JSONB NOT NULL,
  last_error        TEXT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ NULL,
  finished_at       TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS jobs_ws_created_idx ON jobs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_ws_status_idx  ON jobs(workspace_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_ws_idem_uniq
  ON jobs(workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS run_logs (
  id           BIGSERIAL PRIMARY KEY,
  job_id       TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level        TEXT NOT NULL,
  msg          TEXT NOT NULL,
  meta_json    JSONB NULL
);

CREATE INDEX IF NOT EXISTS run_logs_job_ts_idx ON run_logs(job_id, ts DESC);