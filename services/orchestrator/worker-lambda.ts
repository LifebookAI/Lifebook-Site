/**
 * Lifebook Orchestrator Worker Lambda
 * -----------------------------------
 * SQS entrypoint that:
 *   - Parses each record body for a jobId
 *   - Runs the job via runJob(jobId, handler)
 *   - Lets the state machine handle idempotency / redeliveries
 *
 * The actual work is currently a no-op placeholder; real workflow execution
 * will be implemented in a separate handler module.
 */

import type { SQSEvent, SQSRecord } from "aws-lambda";
import { runJob, type JobHandler } from "./job-runner";
import type { JobRecord } from "./job-contract";

const noopHandler: JobHandler = async (_job: JobRecord) => {
  // TODO: plug in real workflow execution (HTTP/Git/File/Text/Transcribe/Export)
  // For now, this is intentionally a no-op that just exercises the state machine.
  return;
};

function extractJobId(record: SQSRecord): string {
  let parsed: any;
  try {
    parsed = JSON.parse(record.body);
  } catch {
    throw new Error("Invalid SQS message body; expected JSON with jobId field");
  }

  const jobId = parsed.jobId ?? parsed.job_id;
  if (!jobId || typeof jobId !== "string") {
    throw new Error("SQS message body missing string jobId");
  }

  return jobId;
}

export const handler = async (event: SQSEvent): Promise<void> => {
  const errors: string[] = [];

  for (const record of event.Records ?? []) {
    try {
      const jobId = extractJobId(record);
      await runJob(jobId, noopHandler);
    } catch (err: any) {
      const msg =
        typeof err?.message === "string"
          ? err.message
          : typeof err === "string"
          ? err
          : JSON.stringify(err);
      errors.push(msg);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `One or more orchestrator worker records failed: ${errors.join("; ")}`
    );
  }
};
