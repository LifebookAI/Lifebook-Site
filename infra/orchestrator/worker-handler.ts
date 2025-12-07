import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import type { SQSHandler } from "aws-lambda";
import type {
  JobStatus,
  OrchestratorJobMessage,
} from "../../lib/jobs/types";
import { appendRunLog } from "../../lib/jobs/run-logs-dynamo";
import { upsertLibraryRunWithArtifacts } from "../../lib/library/write-run";

const region = process.env.AWS_REGION ?? "us-east-1";
const jobsTable = process.env.JOBS_TABLE_NAME;

if (!jobsTable) {
  throw new Error("JOBS_TABLE_NAME env var is required");
}

const dynamo = new DynamoDBClient({ region });

async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  extra: { lastError?: string } = {},
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
    }),
  );
}

/**
 * Resolve a workspace id for Library writes.
 *
 * For now we reuse LIBRARY_DEBUG_WORKSPACE_ID so we can safely test against
 * a single workspace without leaking cross-tenant data from the worker.
 */
function getLibraryWorkspaceId(): string | null {
  const workspaceId = process.env.LIBRARY_DEBUG_WORKSPACE_ID;

  if (!workspaceId) {
    if (process.env.NODE_ENV === "development") {
      // Best-effort warning; do not throw from worker
      console.warn(
        "[library] LIBRARY_DEBUG_WORKSPACE_ID not set; skipping Library run write from worker.",
      );
    }
    return null;
  }

  return workspaceId;
}

/**
 * Best-effort hook that writes a Library run record when a job succeeds.
 *
 * This should never cause the worker to fail; errors are logged and recorded
 * in run logs but do not throw.
 */
async function maybeWriteLibraryRun(
  msg: OrchestratorJobMessage,
): Promise<void> {
  const workspaceId = getLibraryWorkspaceId();
  if (!workspaceId) {
    return;
  }

  const now = new Date();

  try {
    await upsertLibraryRunWithArtifacts(
      {
        id: msg.jobId,
        workspaceId,
        label: `Workflow run: ${msg.workflowSlug}`,
        status: "success",
        startedAt: now,
        completedAt: now,
        sourceJobId: msg.jobId,
        sourceKind: "workflow",
      },
      [],
    );

    await appendRunLog({
      jobId: msg.jobId,
      statusBefore: "succeeded",
      statusAfter: "succeeded",
      step: "worker.library.write",
      message: `Recorded Library run for workflow ${msg.workflowSlug}`,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unhandled error while writing Library run";

    if (process.env.NODE_ENV === "development") {
      console.error("[library] Failed to upsert Library run", err);
    }

    await appendRunLog({
      jobId: msg.jobId,
      statusBefore: "succeeded",
      statusAfter: "succeeded",
      step: "worker.library.error",
      message,
    });
  }
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

      // Best-effort Library write; failures are logged but do not fail the job.
      await maybeWriteLibraryRun(msg);
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