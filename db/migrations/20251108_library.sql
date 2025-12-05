-- 20251108_library.sql
-- Library runs & artifacts schema (Phase 4 / 19B Personal Library)
-- NOTE: This is deliberately minimal and future-proof:
--   - IDs/workspace_id are TEXT so callers can use UUIDs or other opaque IDs.
--   - No FK to orchestrator/jobs yet; add once FD-9 schema is finalized.

BEGIN;

CREATE TABLE IF NOT EXISTS library_runs (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL,
  label        text NOT NULL,
  status       text NOT NULL, -- e.g. "success", "failed", "running"
  started_at   timestamptz NOT NULL,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  source_job_id text,         -- optional: orchestration job ID (text/uuid, no FK yet)
  source_kind   text NOT NULL DEFAULT 'workflow' -- e.g. "workflow", "capture", "import"
);

COMMENT ON TABLE library_runs IS
  'High-level runs whose outputs are stored in the Personal Library (Phase 4 / 19B).';

CREATE INDEX IF NOT EXISTS idx_library_runs_workspace_started_at
  ON library_runs (workspace_id, started_at DESC);

-- Artifacts created by a Library run (transcripts, summaries, exports, etc.)
CREATE TABLE IF NOT EXISTS library_artifacts (
  id           text PRIMARY KEY,
  run_id       text NOT NULL REFERENCES library_runs(id) ON DELETE CASCADE,
  label        text NOT NULL,
  type         text NOT NULL,  -- "transcript" | "summary" | "export" | "other"
  storage_uri  text,           -- pointer to S3 key / external location
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE library_artifacts IS
  'Artifacts produced by a Library run (Phase 4 / 19B).';

CREATE INDEX IF NOT EXISTS idx_library_artifacts_run_id
  ON library_artifacts (run_id);

COMMIT;