"use client";

import type { TriggerType, WorkflowKey } from "./types";
import type {
  CreateJobRequest,
  CreateJobResponse,
} from "@/lib/jobs/types";

export interface RunWorkflowResult {
  ok: boolean;
  status: number;
  jobId?: string;
  error?: string;
}

export async function runWorkflow(
  params: CreateJobRequest
): Promise<RunWorkflowResult> {
  const res = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = undefined;
  }

  if (!res.ok) {
    const err =
      typeof data === "object" && data !== null && "error" in data
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data as any).error
        : "Failed to create job";
    return {
      ok: false,
      status: res.status,
      error: err ?? "Failed to create job",
    };
  }

  const body = data as CreateJobResponse;
  return {
    ok: true,
    status: res.status,
    jobId: body.jobId,
  };
}

// Convenience wrapper for the sample workflow used in Step 19.
export async function runSampleHelloWorkflow() {
  return runWorkflow({
    workflowKey: "sample_hello_world" as WorkflowKey,
    triggerType: "manual" as TriggerType,
  });
}
