/**
 * Lifebook Orchestrator Job Store
 * -------------------------------
 * DynamoDB-backed persistence for JobRecord, using the job contract/state
 * machine defined in ./job-contract.
 *
 * This implementation is an adapter around the existing table shape used in
 * lifebook-orchestrator-jobs. It supports multiple key layouts so we can
 * interoperate with legacy writers:
 *
 * Supported key shapes (tried in this order):
 *   - pk/sk       : { pk: jobId, sk: "job" }
 *   - job_id      : { job_id: jobId }
 *   - jobId       : { jobId: jobId }
 *
 * Env (any of these, in priority order):
 *   ORCHESTRATOR_JOBS_TABLE
 *   LFLBK_ORCH_JOBS_TABLE
 *   LF_ORCH_TABLE
 *
 * If none are set, we fall back to "lifebook-orchestrator-jobs".
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

const JOBS_TABLE_ENV_KEYS = [
  "ORCHESTRATOR_JOBS_TABLE",
  "LFLBK_ORCH_JOBS_TABLE",
  "LF_ORCH_TABLE",
];

function getJobsTableName(): string {
  for (const key of JOBS_TABLE_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value;
    }
  }

  const fallback = "lifebook-orchestrator-jobs";
  console.warn(
    `No orchestrator jobs table env var set (${JOBS_TABLE_ENV_KEYS.join(
      ", "
    )}); falling back to '${fallback}'.`
  );
  return fallback;
}

/**
 * Supported key shapes.
 *
 * We try these in order both for Get and Update. For Get:
 *  - If a shape returns ValidationException (wrong key schema), we try the next.
 *  - If a shape returns an Item, we use that shape for future updates.
 */
type JobKeyShapeName = "pk_sk" | "job_id" | "jobId";

interface JobKeyShape {
  name: JobKeyShapeName;
  makeKey(jobId: string): Record<string, any>;
}

const JOB_KEY_SHAPES: JobKeyShape[] = [
  {
    name: "pk_sk",
    makeKey(jobId: string) {
      return { pk: jobId, sk: "job" };
    },
  },
  {
    name: "job_id",
    makeKey(jobId: string) {
      return { job_id: jobId };
    },
  },
  {
    name: "jobId",
    makeKey(jobId: string) {
      return { jobId: jobId };
    },
  },
];

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
 * Map a raw DynamoDB item from the table into a JobRecord.
 */
function fromDdbItem(item: any): JobRecord {
  const jobId: string =
    item.job_id ?? item.jobId ?? item.jobID ?? item.pk ?? "unknown-job-id";

  const status = (item.status ?? "queued") as JobStatus;

  const createdAt: string =
    item.created_at ?? item.createdAt ?? new Date().toISOString();
  const updatedAt: string = item.updated_at ?? item.updatedAt ?? createdAt;

  const attempt: number =
    typeof item.attempt === "number"
      ? item.attempt
      : typeof item.attempts === "number"
      ? item.attempts
      : 0;

  const payload =
    item.payload ??
    {
      workspaceId: item.workspace_id,
      workflowId: item.workflow_id,
      triggerType: item.trigger_type,
    };

  const record: JobRecord = {
    jobId,
    status,
    createdAt,
    updatedAt,
    attempt,
    payload,
  };

  const errorCode = item.errorCode ?? item.last_error_code;
  const errorMessage = item.errorMessage ?? item.last_error_message;
  const cancelledReason = item.cancelledReason ?? item.cancelled_reason;

  if (errorCode) {
    record.errorCode = errorCode;
  }
  if (errorMessage) {
    record.errorMessage = errorMessage;
  }
  if (cancelledReason) {
    record.cancelledReason = cancelledReason;
  }

  return record;
}

/**
 * Map a JobRecord back into an item. We include multiple key-ish attributes
 * (pk, job_id, jobId) so the table can use any of them as its real PK.
 * Update operations use the actual key shape discovered via Get.
 */
function toDdbItem(record: JobRecord): Record<string, any> {
  return {
    pk: record.jobId,
    sk: "job",
    job_id: record.jobId,
    jobId: record.jobId,
    status: record.status,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    attempts: record.attempt ?? 0,
    // safer default; callers can overwrite later if needed
    max_attempts: 5,
    payload: record.payload,
    last_error_code: record.errorCode ?? null,
    last_error_message: record.errorMessage ?? null,
    cancelled_reason: record.cancelledReason ?? null,
  };
}

interface InternalJobRecord {
  record: JobRecord;
  keyShape: JobKeyShape;
}

/**
 * Internal helper: try all known key shapes until we can successfully load
 * the job. We memoize nothing yet (cold-start cost is tiny vs. job latency),
 * but we log if *no* shape works.
 */
async function getJobInternal(jobId: string): Promise<InternalJobRecord | null> {
  const tableName = getJobsTableName();
  let lastError: unknown;

  for (const shape of JOB_KEY_SHAPES) {
    const key = shape.makeKey(jobId);
    try {
      const res = await docClient.send(
        new GetCommand({
          TableName: tableName,
          Key: key,
        })
      );

      if (res.Item) {
        return { record: fromDdbItem(res.Item), keyShape: shape };
      }
    } catch (err: any) {
      lastError = err;
      const code =
        err?.name ??
        err?.Code ??
        err?.code ??
        (typeof err?.message === "string" ? err.message : undefined);

      // Wrong key schema → try next shape.
      if (code && String(code).includes("ValidationException")) {
        continue;
      }

      // Anything else is a real error.
      throw err;
    }
  }

  if (lastError) {
    console.warn(
      `getJobInternal: unable to load jobId='${jobId}' with any supported key shape. Last error:`,
      lastError
    );
  }

  return null;
}

/**
 * Load a single job by id, or null if it does not exist.
 */
export async function getJob(jobId: string): Promise<JobRecord | null> {
  const result = await getJobInternal(jobId);
  return result ? result.record : null;
}

/**
 * Persist a brand new job record.
 *
 * Uses a conditional put to avoid overwriting an existing job with the same id.
 * NOTE: this is not used by the worker right now; synthetic jobs are written
 * via CLI, but we keep this for completeness.
 */
export async function putNewJob(record: JobRecord): Promise<void> {
  const tableName = getJobsTableName();

  const item = toDdbItem(record);

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
      // Use a generic idempotency guard; we don't know which key attr is the PK,
      // so we just make sure *none* of the candidate id fields exist.
      ConditionExpression:
        "attribute_not_exists(pk) AND attribute_not_exists(job_id) AND attribute_not_exists(jobId)",
    })
  );
}

/**
 * Safely update job status using the job state machine.
 *
 * - Loads the current record (trying multiple key shapes)
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

  const internal = await getJobInternal(params.jobId);
  if (!internal) {
    throw new Error(`Job not found: ${params.jobId}`);
  }

  const current = internal.record;
  const keyShape = internal.keyShape;

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
    next.errorCode = params.errorCode ?? next.errorCode;
    next.errorMessage = params.errorMessage ?? next.errorMessage;
  } else {
    // For non-failed states, clear error fields.
    (next as any).errorCode = undefined;
    (next as any).errorMessage = undefined;
  }

  if (params.nextStatus === "cancelled") {
    next.cancelledReason = params.cancelledReason ?? next.cancelledReason;
  } else {
    (next as any).cancelledReason = undefined;
  }

  // Use the current status value in the conditional expression to protect
  // against concurrent writers racing to update the same job.
  const expectedStatus = current.status;
  const key = keyShape.makeKey(params.jobId);

  const res = await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: key,
      ConditionExpression: "#status = :expectedStatus",
            UpdateExpression:
        "SET #status = :status, " +
        "updated_at = :updatedAt, " +
        "attempts = :attempts, " +
        "payload = :payload, " +
        "last_error_code = :errorCode, " +
        "last_error_message = :errorMessage, " +
        "cancelled_reason = :cancelledReason",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":expectedStatus": expectedStatus,
        ":status": next.status,
        ":updatedAt": next.updatedAt,
        ":attempts": next.attempt ?? 0,
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

  return fromDdbItem(res.Attributes);
}