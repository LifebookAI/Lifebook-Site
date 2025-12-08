"use server";

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface RunSummary {
  id: string;
  label: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RunDetail extends RunSummary {
  workflowSlug: string;
  inputSummary: string | null;
  outputSummary: string | null;
  errorMessage: string | null;
}

// Temporary in-memory demo data so the Library UI is navigable.
// TODO: replace with real orchestrator runs storage.
const DEMO_RUNS: RunDetail[] = [
  {
    id: "demo-run-1",
    label: "Demo transcription run",
    status: "succeeded",
    workflowSlug: "demo-transcription",
    inputSummary: "Demo audio uploaded via dashboard.",
    outputSummary: "Transcript and chapters generated successfully.",
    errorMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export async function listRuns(): Promise<RunSummary[]> {
  // Strip detail-only fields so the index stays light.
  return DEMO_RUNS.map(
    ({ workflowSlug, inputSummary, outputSummary, errorMessage, ...summary }) => summary,
  );
}

export async function getRunDetail(id: string): Promise<RunDetail | null> {
  return DEMO_RUNS.find((run) => run.id === id) ?? null;
}
