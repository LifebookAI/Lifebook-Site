import { pgQuery } from "@/lib/j1-db";

export type LibraryArtifactType =
  | "transcript"
  | "summary"
  | "export"
  | "other";

export type LibraryArtifact = {
  id: string;
  label: string;
  type: LibraryArtifactType;
  createdAt: string;
};

export type LibraryRunStatus = "success" | "failed" | "running";

export type LibraryRun = {
  id: string;
  label: string;
  status: LibraryRunStatus;
  startedAt: string;
  completedAt?: string;
  artifacts: LibraryArtifact[];
};

const STUB_BASE_TIME = "2025-01-01T00:00:00.000Z";

/**
 * Coerce a Postgres value (string | Date | unknown) into a string suitable
 * for rendering in React.
 */
function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
}

/**
 * DB row shapes for library_runs and library_artifacts.
 * These mirror db/migrations/20251108_library.sql so that
 * getLibraryRuns/getLibraryRun can map rows into the LibraryRun domain type
 * without leaking column names throughout the app.
 */
type LibraryRunRow = {
  id: string;
  workspace_id: string;
  label: string;
  status: string;
  started_at: string | Date;
  completed_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
  source_job_id: string | null;
  source_kind: string;
};

type LibraryArtifactRow = {
  id: string;
  run_id: string;
  label: string;
  type: string;
  storage_uri: string | null;
  metadata: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

/**
 * Map a DB row into the LibraryRun domain model.
 * Artifacts are passed in separately so callers can join/fetch them however
 * they like (1 query with join, 2 queries, etc.).
 */
function mapArtifactRow(row: LibraryArtifactRow): LibraryArtifact {
  const type: LibraryArtifactType =
    row.type === "transcript" ||
    row.type === "summary" ||
    row.type === "export" ||
    row.type === "other"
      ? row.type
      : "other";

  return {
    id: row.id,
    label: row.label,
    type,
    createdAt: toIsoString(row.created_at),
  };
}

function mapRunRow(
  row: LibraryRunRow,
  artifacts: LibraryArtifactRow[],
): LibraryRun {
  const status: LibraryRunStatus =
    row.status === "success" ||
    row.status === "failed" ||
    row.status === "running"
      ? row.status
      : "success"; // conservative default if data is malformed

  return {
    id: row.id,
    label: row.label,
    status,
    startedAt: toIsoString(row.started_at),
    completedAt: row.completed_at ? toIsoString(row.completed_at) : undefined,
    artifacts: artifacts.map(mapArtifactRow),
  };
}

// NOTE: This is stub data only. In a follow-up Phase 4 step we will
// replace this with real runs + artifacts from the Library/orchestrator store.
export function buildStubRun(runId: string): LibraryRun {
  return {
    id: runId,
    label: `Example run for ${runId}`,
    status: "success",
    startedAt: STUB_BASE_TIME,
    completedAt: STUB_BASE_TIME,
    artifacts: [
      {
        id: `${runId}-art-1`,
        label: "Transcript (stub)",
        type: "transcript",
        createdAt: STUB_BASE_TIME,
      },
      {
        id: `${runId}-art-2`,
        label: "Summary (stub)",
        type: "summary",
        createdAt: STUB_BASE_TIME,
      },
    ],
  };
}

export function getStubRuns(): LibraryRun[] {
  // For now, return a single example run. Later, this will be replaced or
  // wrapped by a real "get library runs" implementation that talks to the
  // database and respects workspace/entitlements.
  return [buildStubRun("example-run-1")];
}

const LIBRARY_DEBUG_WORKSPACE_ENV_KEY = "LIBRARY_DEBUG_WORKSPACE_ID";

// Internal helper — keep DB wiring in one place.
// Server-only in practice: do not import this module into client components.
function canUseDatabase(): boolean {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "development") {
      if (typeof console !== "undefined") {
        console.warn(
          "[library] DATABASE_URL not set; Library run loaders will use stub data.",
        );
      }
    }
    return false;
  }
  return true;
}

/**
 * Resolve a workspace_id for DB-backed Library queries.
 *
 * For now, this is driven by an env var so we can safely test against a
 * single workspace without leaking cross-tenant data. Once the main
 * workspace/auth wiring is in place, this helper should be replaced with a
 * real "current workspace" resolver.
 */
function getWorkspaceIdForDb(): string | null {
  const id = process.env[LIBRARY_DEBUG_WORKSPACE_ENV_KEY];

  if (!id) {
    if (process.env.NODE_ENV === "development") {
      if (typeof console !== "undefined") {
        console.warn(
          `[library] ${LIBRARY_DEBUG_WORKSPACE_ENV_KEY} not set; Library loaders will use stub data.`,
        );
      }
    }
    return null;
  }

  return id;
}

/**
 * Server-only loader for Library runs.
 *
 * In this MVP slice, we prefer real DB data when DATABASE_URL
 * and LIBRARY_DEBUG_WORKSPACE_ID are set, but always fall back to stub
 * data on misconfiguration or runtime errors.
 */
export async function getLibraryRuns(): Promise<LibraryRun[]> {
  if (!canUseDatabase()) {
    return getStubRuns();
  }

  const workspaceId = getWorkspaceIdForDb();
  if (!workspaceId) {
    return getStubRuns();
  }

  try {
    const { rows: runRows } = await pgQuery<LibraryRunRow>(
      `
        SELECT
          id,
          workspace_id,
          label,
          status,
          started_at,
          completed_at,
          created_at,
          updated_at,
          source_job_id,
          source_kind
        FROM library_runs
        WHERE workspace_id = $1
        ORDER BY started_at DESC
        LIMIT 50
      `,
      [workspaceId],
    );

    if (runRows.length === 0) {
      return [];
    }

    const runIds = runRows.map((row) => row.id);

    const { rows: artifactRows } = await pgQuery<LibraryArtifactRow>(
      `
        SELECT
          id,
          run_id,
          label,
          type,
          storage_uri,
          metadata,
          created_at,
          updated_at
        FROM library_artifacts
        WHERE run_id = ANY($1::text[])
      `,
      [runIds],
    );

    const artifactsByRun = new Map<string, LibraryArtifactRow[]>();

    for (const artifact of artifactRows) {
      const current = artifactsByRun.get(artifact.run_id) ?? [];
      current.push(artifact);
      artifactsByRun.set(artifact.run_id, current);
    }

    return runRows.map((row) =>
      mapRunRow(row, artifactsByRun.get(row.id) ?? []),
    );
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      if (typeof console !== "undefined") {
        console.error("[library] Error loading Library runs; falling back to stub data.", error);
      }
    }
    return getStubRuns();
  }
}

/**
 * Server-only loader for a single Library run.
 *
 * For now this function prefers DB data when available for the configured
 * workspace, but still falls back to a per-run stub if needed.
 */
export async function getLibraryRun(runId: string): Promise<LibraryRun> {
  if (!canUseDatabase()) {
    return buildStubRun(runId);
  }

  const workspaceId = getWorkspaceIdForDb();
  if (!workspaceId) {
    return buildStubRun(runId);
  }

  try {
    const { rows: runRows } = await pgQuery<LibraryRunRow>(
      `
        SELECT
          id,
          workspace_id,
          label,
          status,
          started_at,
          completed_at,
          created_at,
          updated_at,
          source_job_id,
          source_kind
        FROM library_runs
        WHERE id = $1
          AND workspace_id = $2
        LIMIT 1
      `,
      [runId, workspaceId],
    );

    if (runRows.length === 0) {
      if (process.env.NODE_ENV === "development") {
        if (typeof console !== "undefined") {
          console.warn(
            `[library] No library_runs row found for runId=${runId} workspaceId=${workspaceId}; falling back to stub.`,
          );
        }
      }
      return buildStubRun(runId);
    }

    const runRow = runRows[0];

    const { rows: artifactRows } = await pgQuery<LibraryArtifactRow>(
      `
        SELECT
          id,
          run_id,
          label,
          type,
          storage_uri,
          metadata,
          created_at,
          updated_at
        FROM library_artifacts
        WHERE run_id = $1
        ORDER BY created_at ASC
      `,
      [runId],
    );

    return mapRunRow(runRow, artifactRows);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      if (typeof console !== "undefined") {
        console.error(
          `[library] Error loading Library run ${runId}; falling back to stub.`,
          error,
        );
      }
    }
    return buildStubRun(runId);
  }
}