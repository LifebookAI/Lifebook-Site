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

/**
 * Orchestrator runs facade
 *
 * NOTE: These are stub implementations so the Library UI can render.
 * Wire these to the real orchestrator storage (e.g., Postgres/SQS-backed runs table)
 * in the next slice.
 */
export async function listRuns(): Promise<RunSummary[]> {
  // TODO: Replace with real data source.
  return [];
}

export async function getRunDetail(id: string): Promise<RunDetail | null> {
  // TODO: Replace with real data source.
  return null;
}
