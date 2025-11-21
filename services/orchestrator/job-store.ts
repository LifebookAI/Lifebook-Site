/**
 * Lifebook Orchestrator Job Store
 * -------------------------------
 * DynamoDB-backed persistence for JobRecord, using the job contract/state
 * machine defined in ./job-contract.
 *
 * Env:
 *   ORCHESTRATOR_JOBS_TABLE = DynamoDB table name for orchestrator jobs
 *
 * Table schema (recommended):
 *   PK: jobId (S)
 *   SK: (none) — simple primary key
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import type { JobRecord, JobStatus } from "./job-contract";
import { applyStatusTransition } from "./job-contract";

const JOBS_TABLE_ENV = "ORCHESTRATOR_JOBS_TABLE";

function getJobsTableName(): string {
  const name = process.env[JOBS_TABLE_ENV];
  if (!name) {
    throw new Error(
      `Missing ${JOBS_TABLE_ENV} environment variable for orchestrator jobs table`
    );
  }
  return name;
}

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

/**
 * Load a single job by id, or null if it does not exist.
 */
export async function getJob(jobId: string): Promise<JobRecord | null> {
  const tableName = getJobsTableName();

  const result = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { jobId },
    })
  );

  if (!result.Item) {
    return null;
  }

  // Narrowing: we trust the stored shape to match JobRecord.
  return result.Item as JobRecord;
}

/**
 * Persist a brand new job record.
 *
 * Uses a conditional put to avoid overwriting an existing job with the same id.
 */
export async function putNewJob(record: JobRecord): Promise<void> {
  const tableName = getJobsTableName();

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: record,
      ConditionExpression: "attribute_not_exists(jobId)",
    })
  );
}

/**
 * Safely update job status using the job state machine.
 *
 * - Loads the current record
 * - Optionally enforces a caller-provided expectedStatus precondition
 * - Applies the status transition in memory
 * - Conditionally updates DynamoDB only if `status` is still the current value
 * - Returns the updated record
 *
 * Callers are responsible for choosing sensible nextStatus values
 * (e.g., queued -> running, running -> succeeded/failed).
 */
export async function updateJobStatus(params: {
  jobId: string;
  expectedStatus?: JobStatus;
  nextStatus: JobStatus;
  errorCode?: string;
  errorMessage?: string;
  cancelledReason?: string;
}): Promise<JobRecord> {
  const tableName = getJobsTableName();

  const current = await getJob(params.jobId);
  if (!current) {
    throw new Error(`Job not found: ${params.jobId}`);
  }

  // Optional precondition: if caller provided expectedStatus and it does not
  // match the current value, bail out before doing any write.
  if (params.expectedStatus && params.expectedStatus !== current.status) {
    throw new Error(
      `Status precondition failed for job ${params.jobId}: expected ${params.expectedStatus}, found ${current.status}`
    );
  }

  // Apply state machine / idempotency rules.
  const next = applyStatusTransition(current, params.nextStatus);

  if (params.nextStatus === "failed") {
    next.errorCode = params.errorCode ?? next.errorCode ?? null;
    next.errorMessage = params.errorMessage ?? next.errorMessage ?? null;
  } else {
    // For non-failed states, clear error fields.
    (next as any).errorCode = null;
    (next as any).errorMessage = null;
  }

  if (params.nextStatus === "cancelled") {
    next.cancelledReason = params.cancelledReason ?? next.cancelledReason ?? null;
  } else {
    (next as any).cancelledReason = null;
  }

  // Use the current status value in the conditional expression to protect
  // against concurrent writers racing to update the same job.
  const expectedStatus = current.status;

  const res = await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { jobId: params.jobId },
      ConditionExpression: "#status = :expectedStatus",
      UpdateExpression: [
        "SET",
        "#status = :status",
        "updatedAt = :updatedAt",
        "attempt = :attempt",
        "payload = :payload",
        "errorCode = :errorCode",
        "errorMessage = :errorMessage",
        "cancelledReason = :cancelledReason",
      ].join(", "),
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":expectedStatus": expectedStatus,
        ":status": next.status,
        ":updatedAt": next.updatedAt,
        ":attempt": next.attempt,
        ":payload": next.payload,
        ":errorCode": next.errorCode ?? null,
        ":errorMessage": next.errorMessage ?? null,
        ":cancelledReason": next.cancelledReason ?? null,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  if (!res.Attributes) {
    throw new Error(
      `updateJobStatus succeeded but returned no Attributes for job ${params.jobId}`
    );
  }

  return res.Attributes as JobRecord;
}
