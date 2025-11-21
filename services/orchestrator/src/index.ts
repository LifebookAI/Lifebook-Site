import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { updateJobStatus } from "../job-store";
import type { JobStatus } from "../job-contract";

const s3 = new S3Client({});
const BUCKET = process.env.S3_BUCKET || "lifebook.ai";
const KMS = process.env.LFLBK_KMS_KEY;

// Accept both camelCase and snake_case job ids to match existing producers.
type Incoming = {
  jobId?: string;
  job_id?: string;
  outputs?: { s3Out?: { bucket?: string; key?: string } };
};

/**
 * Minimal orchestrator worker:
 * - Accepts SQS-style events (Records[].body) or a direct event payload.
 * - Writes a markdown "result" file to S3.
 * - Best-effort updates the orchestrator jobs table using the job-store
 *   adapter, moving jobs through queued -> running -> succeeded/failed.
 * - Accepts both jobId (camelCase) and job_id (snake_case).
 */
export const handler = async (event: any) => {
  const records = Array.isArray(event?.Records)
    ? event.Records
    : [{ body: JSON.stringify(event) }];

  for (const r of records) {
    const body: Incoming = JSON.parse(r.body ?? "{}");

    // Prefer jobId, then job_id, then fall back to a manual id
    const jobId =
      body.jobId ??
      body.job_id ??
      `manual-${Math.random().toString(36).slice(2, 10)}`;

    const outBucket = body.outputs?.s3Out?.bucket || BUCKET;
    const outKey =
      body.outputs?.s3Out?.key || `workflows/manual/${jobId}/result.md`;

    const content = `# Lifebook Orchestrator
Job: ${jobId}
When: ${new Date().toISOString()}
Result: OK (hello from minimal handler)
`;

    const isRealJob = jobId.startsWith("job-");

    // 1) Mark job as running (best-effort; log on failure, but don't hard-fail).
    if (isRealJob) {
      try {
        await updateJobStatus({
          jobId,
          expectedStatus: "queued" as JobStatus,
          nextStatus: "running",
        });
        console.log(`Job ${jobId} marked as running.`);
      } catch (err) {
        console.warn(
          `Unable to mark job ${jobId} as running (will still attempt work):`,
          err
        );
      }
    }

    try {
      // 2) Do the actual work (write result to S3).
      const cmd = new PutObjectCommand({
        Bucket: outBucket,
        Key: outKey,
        Body: content,
        ContentType: "text/markdown; charset=utf-8",
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: KMS,
      });
      await s3.send(cmd);
      console.log(`WROTE s3://${outBucket}/${outKey}`);

      // 3) On success, mark job as succeeded (best-effort).
      if (isRealJob) {
        try {
          await updateJobStatus({
            jobId,
            // If another worker already moved it to running/succeeded, the
            // state machine + conditional update will protect us.
            nextStatus: "succeeded",
          });
          console.log(`Job ${jobId} marked as succeeded.`);
        } catch (err) {
          console.warn(
            `Unable to mark job ${jobId} as succeeded (S3 write is still OK):`,
            err
          );
        }
      }
    } catch (err) {
      console.error(`Worker error for job ${jobId}:`, err);

      // 4) On failure, attempt to mark job as failed, then rethrow so SQS
      //    semantics (retries / DLQ) still apply.
      if (isRealJob) {
        try {
          const msg =
            err instanceof Error ? err.message : JSON.stringify(err);
          await updateJobStatus({
            jobId,
            nextStatus: "failed",
            errorCode: "WORKER_ERROR",
            errorMessage: msg,
          });
          console.log(`Job ${jobId} marked as failed.`);
        } catch (statusErr) {
          console.warn(
            `Unable to mark job ${jobId} as failed after worker error:`,
            statusErr
          );
        }
      }

      throw err;
    }
  }

  return { ok: true };
};