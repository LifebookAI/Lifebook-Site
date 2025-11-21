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
const allowedTransitions = {
    queued: ["running", "cancelled"],
    running: ["succeeded", "failed", "cancelled"],
    succeeded: [],
    failed: [],
    cancelled: [],
};
/**
 * Returns true if a transition from `from` -> `to` is allowed by the state machine.
 */
export function canTransition(from, to) {
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
export function applyStatusTransition(record, newStatus, now = new Date()) {
    if (!canTransition(record.status, newStatus)) {
        throw new Error(`Illegal job status transition: ${record.status} -> ${newStatus}`);
    }
    const next = {
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
        delete next.errorCode;
        delete next.errorMessage;
    }
    // When marking as cancelled, callers may set cancelledReason before persisting.
    if (newStatus !== "cancelled") {
        delete next.cancelledReason;
    }
    return next;
}
/**
 * Helper to create a brand-new JobRecord for a freshly enqueued job.
 * This is the only place "queued" + initial attempt count is minted.
 */
export function createJobRecord(params) {
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
