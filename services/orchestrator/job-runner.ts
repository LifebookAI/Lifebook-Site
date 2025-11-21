/**
 * Lifebook Orchestrator Job Runner
 * --------------------------------
 * Encapsulates the lifecycle and idempotency for running a single job:
 *
 *   queued -> running -> succeeded | failed | cancelled
 *
 * This module does NOT know about SQS, Lambdas, or specific workflow steps.
 * It expects a handler that takes a JobRecord and performs the actual work.
 */

import type { JobRecord } from "./job-contract";
import { getJob, updateJobStatus } from "./job-store";

export type JobHandler = (job: JobRecord) => Promise<void>;

/**
 * Run a single job through the standard lifecycle around a handler:
 *
 *   - No-op if the job is already in a terminal state
 *   - queued -> running (if needed)
 *   - handler(job)
 *   - running -> succeeded on success
 *   - running -> failed on error (with error details)
 *
 * This function is safe to call from SQS/Lambda handlers and will naturally
 * handle redeliveries: if the job is already succeeded/failed/cancelled,
 * it will return without doing any work.
 */
export async function runJob(jobId: string, handler: JobHandler): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // Idempotency: if the job is already in a terminal state, we do nothing.
  if (
    job.status === "succeeded" ||
    job.status === "failed" ||
    job.status === "cancelled"
  ) {
    return;
  }

  let current: JobRecord = job;

  // Move queued -> running if needed.
  if (job.status === "queued") {
    current = await updateJobStatus({
      jobId,
      expectedStatus: "queued",
      nextStatus: "running",
    });
  }

  try {
    // Perform the actual work for this job.
    await handler(current);

    // Mark as succeeded if the handler did not throw.
    await updateJobStatus({
      jobId,
      expectedStatus: "running",
      nextStatus: "succeeded",
    });
  } catch (err: any) {
    const message =
      typeof err?.message === "string"
        ? err.message
        : typeof err === "string"
        ? err
        : JSON.stringify(err);

    // On error, mark the job as failed with an error code/message.
    await updateJobStatus({
      jobId,
      expectedStatus: "running",
      nextStatus: "failed",
      errorCode: "WORKER_ERROR",
      errorMessage: message.slice(0, 1000),
    });

    // Re-throw so the caller (e.g., Lambda) can decide whether to re-queue, DLQ, etc.
    throw err;
  }
}
