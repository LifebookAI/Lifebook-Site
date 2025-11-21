/**
 * Lifebook Orchestrator Job Contract
 * ----------------------------------
 * Source of truth for job record shape and allowed status transitions.
 *
 * Aligned with Master Sheet v3.0 — Phase 4 (18A Orchestration & Idempotency).
 *
 * This module should be imported by:
 *  - Orchestrator worker (Lambda/worker code that processes SQS jobs)
 *  - API endpoints that enqueue jobs
 *  - Any admin/debug tooling that needs to reason about job state
 */

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

/**
 * Single row in the orchestrator jobs table.
 *
 * DynamoDB schema (recommended):
 *   PK: job_id (S)
 *   SK: (none) — simple primary key
 *
 * Secondary indexes and additional fields can be added later as needed.
 */
export interface JobRecord {
  jobId: string;
  status: JobStatus;

  /** ISO8601 timestamps in UTC */
  createdAt: string;
  updatedAt: string;

  /** Number of times we've attempted to run this job (monotonic, >= 1). */
  attempt: number;

  /** Arbitrary payload describing what the job should do (workflow, inputs, etc.). */
  payload: unknown;

  /** Optional error metadata, populated only when status === "failed". */
  errorCode?: string;
  errorMessage?: string;

  /** Optional reason for cancellation when status === "cancelled". */
  cancelledReason?: string;
}

/**
 * Allowed state transitions for the orchestrator.
 *
 * Invariants:
 *  - "queued" jobs may transition to "running" or "cancelled".
 *  - "running" jobs may transition to "succeeded", "failed", or "cancelled".
 *  - Terminal states ("succeeded", "failed", "cancelled") cannot transition further.
 *
 * Idempotency:
 *  - Repeating the same transition (e.g., running -> running) should be treated as a no-op.
 *  - Illegal transitions should be rejected at the application layer and never written to storage.
 */
const allowedTransitions: Record<JobStatus, JobStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

/**
 * Returns true if a transition from `from` -> `to` is allowed by the state machine.
 */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  if (from === to) {
    // Idempotent "same status" updates are always safe to treat as no-op.
    return true;
  }
  const next = allowedTransitions[from];
  return Array.isArray(next) ? next.includes(to) : false;
}

/**
 * Applies a status transition to a JobRecord, updating timestamps and attempts.
 * Does NOT perform any I/O (no DynamoDB/SQS here); it's pure in-memory logic.
 *
 * Callers should:
 *  - Check canTransition(old.status, newStatus) BEFORE calling this.
 *  - Persist the returned record atomically (e.g., DynamoDB conditional update).
 */
export function applyStatusTransition(
  record: JobRecord,
  newStatus: JobStatus,
  now: Date = new Date()
): JobRecord {
  if (!canTransition(record.status, newStatus)) {
    throw new Error(
      `Illegal job status transition: ${record.status} -> ${newStatus}`
    );
  }

  const next: JobRecord = {
    ...record,
    status: newStatus,
    updatedAt: now.toISOString(),
  };

  // Increment attempt only when we actually start running work.
  if (record.status !== "running" && newStatus === "running") {
    next.attempt = (record.attempt ?? 0) + 1;
  }

  // When marking as failed, callers should set errorCode/errorMessage explicitly.
  if (newStatus !== "failed") {
    delete (next as Partial<JobRecord>).errorCode;
    delete (next as Partial<JobRecord>).errorMessage;
  }

  // When marking as cancelled, callers may set cancelledReason before persisting.
  if (newStatus !== "cancelled") {
    delete (next as Partial<JobRecord>).cancelledReason;
  }

  return next;
}

/**
 * Helper to create a brand-new JobRecord for a freshly enqueued job.
 * This is the only place "queued" + initial attempt count is minted.
 */
export function createJobRecord(params: {
  jobId: string;
  payload: unknown;
  now?: Date;
}): JobRecord {
  const now = params.now ?? new Date();
  const ts = now.toISOString();

  return {
    jobId: params.jobId,
    status: "queued",
    createdAt: ts,
    updatedAt: ts,
    attempt: 0,
    payload: params.payload,
  };
}
