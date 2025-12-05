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
 * (likely via the jobs/artifacts tables described in FD-9).
 */
export async function getLibraryRuns(): Promise<LibraryRun[]> {
  if (!canUseDatabase()) {
    return getStubRuns();
  }

  // TODO (Phase 4 / 19B):
  //  - Use DATABASE_URL and the orchestrator/jobs tables to fetch real runs
  //  - Filter by current workspace
  //  - Respect entitlements and retention rules
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