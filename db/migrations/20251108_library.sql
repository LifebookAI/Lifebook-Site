-- 20251108_library.sql
-- Lifebook OS Personal Library schema (MVP)
-- Tables: library_items
-- Note: keep extension requirements minimal; IDs are app-generated UUIDs for now.

BEGIN;

CREATE TABLE IF NOT EXISTS library_items (
    id             uuid PRIMARY KEY,          -- app-generated id
    workspace_id   uuid        NOT NULL,      -- owning workspace
    user_id        uuid,                      -- optional: creator / last editor
    artifact_id    uuid,                      -- optional: link to artifacts table

    title          text        NOT NULL,      -- human title
    kind           text        NOT NULL,      -- e.g. 'workflow_output' | 'capture' | 'note' | 'other'
    source_type    text        NOT NULL,      -- e.g. 'workflow' | 'capture' | 'manual' | 'import'
    source_id      text,                      -- workflow_run_id, capture_id, etc.
    project        text,                      -- optional project / collection name

    tags           text[]      NOT NULL DEFAULT '{}',  -- simple tag array

    is_pinned      boolean     NOT NULL DEFAULT false,
    pinned_at      timestamptz,
    last_viewed_at timestamptz,

    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),

    -- For search & recall
    search_text    text,                     -- denormalized body/summary text
    search_vector  tsvector                  -- populated via app or a later trigger
);

-- Indexes for common access paths
CREATE INDEX IF NOT EXISTS idx_library_items_workspace_created
    ON library_items (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_library_items_workspace_pinned
    ON library_items (workspace_id, is_pinned, pinned_at DESC);

CREATE INDEX IF NOT EXISTS idx_library_items_tags
    ON library_items USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_library_items_search_vector
    ON library_items USING GIN (search_vector);

COMMIT;
