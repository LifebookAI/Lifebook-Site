import type { TriggerType, WorkflowKey } from "@/workflows/types";

export type JobId = string;

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export interface JobSummary {
  jobId: JobId;
  workflowKey: WorkflowKey;
  status: JobStatus;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Minimal shape for creating a job from a workflow.
 * The orchestrator/DB layer will take this and persist + enqueue.
 */
export interface CreateJobRequest<Input = unknown> {
  workflowKey: WorkflowKey;
  triggerType: TriggerType;
  input?: Input;
  idempotencyKey?: string;
}

export interface CreateJobResponse {
  jobId: JobId;
}
