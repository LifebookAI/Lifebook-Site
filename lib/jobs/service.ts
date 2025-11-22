import { randomUUID } from "node:crypto";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { CreateJobRequest, CreateJobResponse } from "./types";

/**
 * Region + queue URL for the orchestrator jobs queue.
 * In dev, we *stub* and do not send to SQS to avoid needing AWS creds.
 */
const region =
  process.env.AWS_REGION ?? process.env.LIFEBOOK_AWS_REGION ?? "us-east-1";

const queueUrl = process.env.ORCHESTRATOR_JOBS_QUEUE_URL;

const sqs = new SQSClient({ region });

/**
 * Create a job from a workflow template.
 *
 * Dev:
 *  - Generates a jobId and logs a warning (no SQS call).
 *
 * Non-dev:
 *  - Requires ORCHESTRATOR_JOBS_QUEUE_URL.
 *  - Sends a JSON message with jobId + request payload to SQS.
 */
export async function createJobFromWorkflow(
  req: CreateJobRequest
): Promise<CreateJobResponse> {
  const jobId = randomUUID();

  if (process.env.NODE_ENV === "development") {
    // Safe stub for local dev; wiring to SQS happens in staging/prod.
    console.warn(
      "[lifebook] createJobFromWorkflow dev stub: not sending to SQS. jobId=%s workflowKey=%s triggerType=%s",
      jobId,
      req.workflowKey,
      req.triggerType
    );

    return { jobId };
  }

  if (!queueUrl) {
    throw new Error("ORCHESTRATOR_JOBS_QUEUE_URL is not configured");
  }

  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify({
      jobId,
      ...req,
    }),
  });

  await sqs.send(command);

  return { jobId };
}
