export type JobStatus =
  | "queued"
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export interface CreateJobRequest {
  /**
   * Preferred field: stable identifier for which workflow to run,
   * e.g. "sample_hello_world".
   */
  workflowSlug?: string;

  /**
   * Legacy alias used by earlier UI code.
   * The API layer will normalize workflowKey -> workflowSlug.
   */
  workflowKey?: string;

  /** Arbitrary JSON-serializable workflow input payload. */
  input?: unknown;

  /**
   * Optional idempotency key.
   * If provided, (workflowSlug, clientRequestId) is treated as a
   * logical “same job” and POST /api/jobs will return the same job.
   */
  clientRequestId?: string;

  /**
   * Optional trigger type metadata for analytics / routing.
   * Common values: "manual", "schedule", "webhook".
   */
  triggerType?: string;
}

export interface JobSummary {
  /** Stable job identifier */
  id: string;

  /**
   * Alias for backwards compatibility with older components that
   * referenced job.jobId. Always equal to `id`.
   */
  jobId: string;

  /** Workflow the job is executing */
  workflowSlug: string;

  /** Current state in the orchestrator lifecycle */
  status: JobStatus;

  /** ISO8601 timestamps */
  createdAt: string;
  updatedAt: string;

  /** Optional last run timestamp (for retries / multi-run later) */
  lastRunAt?: string;

  /** Echo of the idempotency key if supplied */
  clientRequestId?: string;
}

/**
 * Canonical response shape for “create job” helper APIs.
 * Older code expects just a jobId, but we optionally include JobSummary
 * for richer callers.
 */
export interface CreateJobResponse {
  jobId: string;
  job?: JobSummary;
}

/**
 * Internal record persisted in DynamoDB.
 *
 * pk/sk exist because the table key is named `pk` (and may use a sort key).
 * We mirror jobId in pk so we can look jobs up by jobId.
 */
export interface JobRecord {
  pk: string;
  sk?: string;

  jobId: string;
  workflowSlug: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  clientRequestId?: string;
  inputJson?: string;
  lastRunAt?: string;
  lastError?: string;
}

/**
 * Public-facing run log entry (exposed via API).
 */
export interface RunLog {
  /** When this log entry was recorded (ISO8601) */
  createdAt: string;

  /** Status transition around this event, if any */
  statusBefore?: JobStatus;
  statusAfter?: JobStatus;

  /** Logical step name, e.g. "worker.start", "worker.complete" */
  step?: string;

  /** Short human-readable message */
  message?: string;
}

/**
 * Internal run log record stored in DynamoDB.
 */
export interface RunLogRecord extends RunLog {
  jobId: string;
  /** Optional JSON-encoded details, truncated for safety */
  detailsJson?: string;
}

/**
 * SQS message sent to the orchestrator worker.
 */
export interface OrchestratorJobMessage {
  jobId: string;
  workflowSlug: string;
}
