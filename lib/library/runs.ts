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
 * DB row shapes for library_runs and library_artifacts.
 * These deliberately mirror db/migrations/20251108_library.sql so that
 * getLibraryRuns/getLibraryRun can map rows into the LibraryRun domain type
 * without leaking column names throughout the app.
 */
type LibraryRunRow = {
  id: string;
  workspace_id: string;
  label: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
};

/**
 * Map a DB row into the LibraryRun domain model.
 * Artifacts are passed in separately so callers can join/fetch them however
 * they like (1 query with join, 2 queries, etc.).
 */
function mapRunRow(
  row: LibraryRunRow,
  artifacts: LibraryArtifactRow[]
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
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    artifacts: artifacts.map(mapArtifactRow),
  };
}

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
    createdAt: row.created_at,
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

// Internal helper — keep DB wiring in one place.
// Server-only in practice: do not import this module into client components.
function canUseDatabase(): boolean {
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "development") {
      if (typeof console !== "undefined") {
        console.warn(
          "[library] DATABASE_URL not set; Library run loaders will use stub data."
        );
      }
    }
    return false;
  }
  return true;
}

/**
 * Server-only loader for Library runs.
 *
 * In this MVP slice, we always fall back to stub data even when a DATABASE_URL
 * is present. A later Phase 4 step will thread a real query through here
 * (likely via the jobs/artifacts tables described in FD-9 and the
 * library_runs/library_artifacts tables).
 */
export async function getLibraryRuns(): Promise<LibraryRun[]> {
  if (!canUseDatabase()) {
    return getStubRuns();
  }

  // TODO (Phase 4 / 19B):
  //  - Use DATABASE_URL and the orchestrator/jobs tables to fetch real runs
  //  - Join or follow-up query library_artifacts
  //  - Filter by current workspace
  //  - Respect entitlements and retention rules
  //
  // When that wiring is in place, the mapper helpers above should be used to
  // convert DB rows into LibraryRun instances.
  return getStubRuns();
}

/**
 * Server-only loader for a single Library run.
 *
 * For now this function resolves from the in-memory list and falls back to a
 * per-run stub if needed. Once the real query is wired, this will call into
 * the same DB-backed path as getLibraryRuns().
 */
export async function getLibraryRun(runId: string): Promise<LibraryRun> {
  const runs = await getLibraryRuns();
  const match = runs.find((run) => run.id === runId);
  if (match) return match;

  // Fallback: still return a stub so the view remains usable in early MVP.
  return buildStubRun(runId);
}