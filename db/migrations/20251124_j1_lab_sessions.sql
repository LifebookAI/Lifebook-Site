-- 20251124_j1_lab_sessions.sql
-- Canonical Jobs + Lab Sessions schema (Phase 4, 18A/19C).
-- This aligns with FD-9 (jobs as core table) and prepares for multi-workspace.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- job_status enum (18A orchestration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
  END IF;
END$$;

-- lab_session_status enum (Study Tracks lifecycle)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lab_session_status') THEN
    CREATE TYPE lab_session_status AS ENUM ('pending', 'active', 'completed', 'archived');
  END IF;
END$$;

-- We’re still in pre-prod for this schema: drop any prior experiments.
DROP TABLE IF EXISTS lab_sessions CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;

-- Core jobs table (FD-9: jobs)
CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership / scoping
  workspace_id uuid,                 -- future-proof for WEA/AW & per-workspace quotas
  user_id uuid,                      -- end-user within workspace (nullable for now)

  -- Identity & routing
  kind text NOT NULL,                -- e.g. 'lab_materialization', 'workflow_run'
  track_slug text,                   -- e.g. 'aws-foundations-j1' (optional for non-track jobs)
  lab_slug text,                     -- optional per-track lab slug
  workflow_id uuid,                  -- future: link to workflows table
  trigger_type text,                 -- 'manual' | 'schedule' | 'webhook' | others

  status job_status NOT NULL DEFAULT 'queued',

  -- Structured context
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,  -- inputs/parameters
  result jsonb,                                -- outputs, e.g. { "sessionId": "…" }
  error_message text,

  -- Idempotency & orchestration hooks (18A)
  idempotency_key text,             -- optional, for schedule/webhook runs
  run_group_id uuid,                -- optional, future: group runs / batches

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  queued_at  timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX idx_jobs_status_created_at ON jobs (status, created_at DESC);
CREATE INDEX idx_jobs_workspace_created_at ON jobs (workspace_id, created_at DESC);
CREATE INDEX idx_jobs_track_created_at ON jobs (track_slug, created_at DESC);

-- Lab sessions (Study Tracks specialization backed by jobs)
CREATE TABLE lab_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id uuid,                    -- keep in sync with job.workspace_id
  user_id uuid,                         -- learner

  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,

  track_slug text NOT NULL,
  lab_slug   text NOT NULL,

  status lab_session_status NOT NULL DEFAULT 'active',

  title text NOT NULL,

  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes     jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX idx_lab_sessions_workspace_created_at
  ON lab_sessions (workspace_id, created_at DESC);

CREATE INDEX idx_lab_sessions_track_created_at
  ON lab_sessions (track_slug, created_at DESC);
