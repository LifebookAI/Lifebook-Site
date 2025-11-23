import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import type { SQSHandler } from "aws-lambda";
import type {
  JobStatus,
  OrchestratorJobMessage,
} from "../../lib/jobs/types";
import { appendRunLog } from "../../lib/jobs/run-logs-dynamo";

const region = process.env.AWS_REGION ?? "us-east-1";
const jobsTable = process.env.JOBS_TABLE_NAME;

if (!jobsTable) {
  throw new Error("JOBS_TABLE_NAME env var is required");
}

const dynamo = new DynamoDBClient({ region });

async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  extra: { lastError?: string } = {}
): Promise<void> {
  const now = new Date().toISOString();

  const exprNames: Record<string, string> = {
    "#status": "status",
    "#updatedAt": "updatedAt",
  };
  const exprValues: Record<string, any> = {
    ":status": { S: status },
    ":updatedAt": { S: now },
  };

  let updateExpr = "SET #status = :status, #updatedAt = :updatedAt";

  if (extra.lastError) {
    exprNames["#lastError"] = "lastError";
    exprValues[":lastError"] = { S: extra.lastError };
    updateExpr += ", #lastError = :lastError";
  }

  await dynamo.send(
    new UpdateItemCommand({
      TableName: jobsTable,
      Key: { jobId: { S: jobId } },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
    })
  );
}

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const msg = JSON.parse(record.body) as OrchestratorJobMessage;

    try {
      await appendRunLog({
        jobId: msg.jobId,
        statusBefore: "queued",
        statusAfter: "running",
        step: "worker.start",
        message: `Worker picked up job for workflow ${msg.workflowSlug}`,
      });

      await updateJobStatus(msg.jobId, "running");

      // TODO: Implement the real workflow engine here.
      await appendRunLog({
        jobId: msg.jobId,
        statusBefore: "running",
        statusAfter: "succeeded",
        step: "worker.complete",
        message: "Marked job as succeeded (no-op worker stub)",
      });

      await updateJobStatus(msg.jobId, "succeeded");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unhandled error in orchestrator worker";

      await appendRunLog({
        jobId: msg.jobId,
        statusBefore: "running",
        statusAfter: "failed",
        step: "worker.error",
        message,
      });

      await updateJobStatus(msg.jobId, "failed", { lastError: message });

      throw err;
    }
  }
};
