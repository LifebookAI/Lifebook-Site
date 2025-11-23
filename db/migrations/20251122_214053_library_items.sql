-- Library items table for Personal Library (19B)
-- NOTE: Apply via your existing migration tooling (psql, Prisma, Drizzle, etc.).

CREATE TABLE IF NOT EXISTS library_items (
  id            text PRIMARY KEY,
  workspace_id  text        NOT NULL,
  title         text        NOT NULL,
  kind          text        NOT NULL,
  source_type   text        NOT NULL,
  project       text,
  tags          text[]      NOT NULL DEFAULT '{}',
  is_pinned     boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_library_items_workspace_created_at
  ON library_items (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_library_items_workspace_project
  ON library_items (workspace_id, project);

-- Seed demo workspace items (matching in-memory examples) for local/dev use.
INSERT INTO library_items (
  id, workspace_id, title, kind, source_type, project, tags, is_pinned, created_at
) VALUES
  (
    'example-1',
    'demo-workspace',
    'Sample workflow run output',
    'workflow_output',
    'workflow',
    'demo',
    ARRAY['sample','hello-world'],
    TRUE,
    now()
  ),
  (
    'example-2',
    'demo-workspace',
    'Capture: S3 lab notes',
    'capture',
    'capture',
    'aws-foundations',
    ARRAY['aws','study-track'],
    FALSE,
    now()
  )
ON CONFLICT (id) DO NOTHING;
