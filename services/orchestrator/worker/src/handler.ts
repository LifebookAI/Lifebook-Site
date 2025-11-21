/**
 * Lifebook Orchestrator Worker — LBAI-ORCH-WORKER-V1
 *
 * Responsibilities:
 * - Consume SQS messages that contain a jobId.
 * - Drive DynamoDB job status transitions: queued → running → completed/failed.
 * - Capture timestamps for startedAt, completedAt, updatedAt.
 *
 * Assumptions:
 * - Environment variable JOBS_TABLE is set to the DynamoDB jobs table name.
 * - IAM role for this Lambda has dynamodb:UpdateItem permissions on that table.
 */

import type { SQSEvent, SQSRecord } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const JOBS_TABLE = process.env.JOBS_TABLE;
if (!JOBS_TABLE) {
  throw new Error("JOBS_TABLE environment variable is required");
}

type JobStatus = "queued" | "running" | "completed" | "failed" | "timed_out";

interface OrchestratorJobMessage {
  jobId: string;
  // Extend with additional orchestrator payload fields as needed.
  // Example:
  // sourceKey?: string;
  // workflowId?: string;
  // stepConfig?: unknown;
  [key: string]: unknown;
}

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

/**
 * Update DynamoDB job status with timestamp and optional metadata.
 */
async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  extra?: Record<string, unknown>
): Promise<void> {
  const now = new Date().toISOString();

  const updateParts: string[] = ["#status = :status", "updatedAt = :updatedAt"];
  const names: Record<string, string> = { "#status": "status" };
  const values: Record<string, unknown> = {
    ":status": status,
    ":updatedAt": now,
  };

  if (status === "running") {
    updateParts.push(
      "startedAt = if_not_exists(startedAt, :startedAt)"
    );
    values[":startedAt"] = now;
  }

  if (status === "completed") {
    updateParts.push("completedAt = :completedAt");
    values[":completedAt"] = now;
  }

  if (status === "failed" && extra?.errorMessage) {
    updateParts.push("errorMessage = :errorMessage");
    values[":errorMessage"] = String(extra.errorMessage).slice(0, 1024);
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (key === "errorMessage") continue;
      const nameKey = `#${key}`;
      const valueKey = `:${key}`;
      names[nameKey] = key;
      values[valueKey] = value;
      updateParts.push(`${nameKey} = ${valueKey}`);
    }
  }

  const command = new UpdateCommand({
    TableName: JOBS_TABLE,
    Key: { jobId },
    UpdateExpression: "SET " + updateParts.join(", "),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  });

  await ddb.send(command);
}

/**
 * Placeholder for the real orchestrator work.
 * For MVP, keep this deterministic and side-effect-limited.
 */
async function processJob(message: OrchestratorJobMessage): Promise<void> {
  // TODO: Implement orchestrator work:
  // - Call into /services/orchestrator steps (http, git, file, text, transcribe, export)
  // - Reserve / refund credits
  // - Emit analytics events from FD-1 (workflow_run_started/completed)
  //
  // For now, this is a no-op placeholder that always succeeds.
  return;
}

/**
 * Lambda entrypoint.
 * For each SQS message:
 * - Parse payload and enforce presence of jobId.
 * - Mark job "running".
 * - Execute orchestrator work.
 * - Mark job "completed" on success or "failed" on error.
 */
export const handler = async (event: SQSEvent): Promise<void> => {
  const records = event.Records ?? [];
  for (const record of records) {
    const message = parseMessage(record);
    const { jobId } = message;

    try {
      await updateJobStatus(jobId, "running");
      await processJob(message);
      await updateJobStatus(jobId, "completed");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      console.error("Orchestrator worker error", {
        jobId,
        errorMessage,
        error,
      });

      try {
        await updateJobStatus(jobId, "failed", { errorMessage });
      } catch (updateError) {
        console.error("Failed to update job status to failed", {
          jobId,
          updateError,
        });
      }

      // Re-throw so SQS redrive / DLQ semantics still apply.
      throw error;
    }
  }
};

/**
 * Parse a single SQS record into an OrchestratorJobMessage with a valid jobId.
 */
function parseMessage(record: SQSRecord): OrchestratorJobMessage {
  if (!record.body) {
    throw new Error("SQS record is missing body");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(record.body);
  } catch (error) {
    throw new Error("Failed to parse SQS message body as JSON");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("jobId" in parsed) ||
    typeof (parsed as any).jobId !== "string"
  ) {
    throw new Error("SQS message does not contain a valid jobId");
  }

  return parsed as OrchestratorJobMessage;
}
