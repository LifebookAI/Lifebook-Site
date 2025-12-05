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