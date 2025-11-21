/**
 * Lifebook Orchestrator Job Store
 * -------------------------------
 * DynamoDB-backed persistence for JobRecord, using the job contract/state
 * machine defined in ./job-contract.
 *
 * This implementation is an adapter around the existing "legacy" table shape
 * used in lifebook-orchestrator-jobs, so application code can work with a
 * clean JobRecord model while the table continues to store fields like
 * pk/sk, created_at, updated_at, attempts, last_error_code, etc.
 *
 * Env (any of these, in priority order):
 *   ORCHESTRATOR_JOBS_TABLE
 *   LFLBK_ORCH_JOBS_TABLE
 *   LF_ORCH_TABLE
 *
 * If none are set, we fall back to "lifebook-orchestrator-jobs".
 *
 * Legacy table schema (per item):
 *   pk               (S) partition key, e.g. "job-<uuid>"
 *   sk               (S) sort key, fixed to "job"
 *   job_id           (S) job id string, mirrors pk
 *   status           (S) "queued" | "running" | "succeeded" | "failed" | "cancelled"
 *   created_at       (S) ISO8601 timestamp
 *   updated_at       (S) ISO8601 timestamp
 *   attempts         (N) number of attempts so far
 *   max_attempts     (N) max attempts allowed
 *   workspace_id     (S) workspace identifier
 *   workflow_id      (S) workflow identifier
 *   trigger_type     (S) "manual" | "scheduled" | ...
 *   last_error_code  (S) optional error code
 *   last_error_message (S) optional error message
 *   cancelled_reason (S) optional cancellation note
 *   ttl_at           (N) Unix epoch seconds for TTL
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, } from "@aws-sdk/lib-dynamodb";
import { applyStatusTransition } from "./job-contract";
const JOBS_TABLE_ENV_KEYS = [
    "ORCHESTRATOR_JOBS_TABLE",
    "LFLBK_ORCH_JOBS_TABLE",
    "LF_ORCH_TABLE",
];
function getJobsTableName() {
    for (const key of JOBS_TABLE_ENV_KEYS) {
        const value = process.env[key];
        if (value && value.trim().length > 0) {
            return value;
        }
    }
    const fallback = "lifebook-orchestrator-jobs";
    console.warn(`No orchestrator jobs table env var set (${JOBS_TABLE_ENV_KEYS.join(", ")}); falling back to '${fallback}'.`);
    return fallback;
}
/**
 * Legacy key shape for orchestrator jobs.
 * pk is the job id string (e.g. "job-xxxx"), sk is a fixed "job".
 */
function makeJobKey(jobId) {
    return {
        pk: jobId,
        sk: "job",
    };
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
 * Map a raw DynamoDB item from the legacy table into a JobRecord.
 */
function fromDdbItem(item) {
    const jobId = item.job_id ?? item.jobId ?? item.pk ?? "unknown-job-id";
    const status = (item.status ?? "queued");
    const createdAt = item.created_at ?? item.createdAt ?? new Date().toISOString();
    const updatedAt = item.updated_at ?? item.updatedAt ?? createdAt;
    const attempt = typeof item.attempt === "number"
        ? item.attempt
        : typeof item.attempts === "number"
            ? item.attempts
            : 0;
    const payload = item.payload ??
        {
            workspaceId: item.workspace_id,
            workflowId: item.workflow_id,
            triggerType: item.trigger_type,
        };
    const record = {
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
 * Map a JobRecord back into the legacy item shape for full writes.
 * Used by putNewJob; updateJobStatus uses an UpdateExpression instead.
 */
function toDdbItem(record) {
    return {
        pk: record.jobId,
        sk: "job",
        job_id: record.jobId,
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
/**
 * Load a single job by id, or null if it does not exist.
 */
export async function getJob(jobId) {
    const tableName = getJobsTableName();
    const result = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: makeJobKey(jobId),
    }));
    if (!result.Item) {
        return null;
    }
    return fromDdbItem(result.Item);
}
/**
 * Persist a brand new job record.
 *
 * Uses a conditional put to avoid overwriting an existing job with the same id.
 */
export async function putNewJob(record) {
    const tableName = getJobsTableName();
    const item = toDdbItem(record);
    await docClient.send(new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: "attribute_not_exists(pk)",
    }));
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
export async function updateJobStatus(params) {
    const tableName = getJobsTableName();
    const current = await getJob(params.jobId);
    if (!current) {
        throw new Error(`Job not found: ${params.jobId}`);
    }
    // Optional precondition: if caller provided expectedStatus and it does not
    // match the current value, bail out before doing any write.
    if (params.expectedStatus && params.expectedStatus !== current.status) {
        throw new Error(`Status precondition failed for job ${params.jobId}: expected ${params.expectedStatus}, found ${current.status}`);
    }
    // Apply state machine / idempotency rules.
    const next = applyStatusTransition(current, params.nextStatus);
    if (params.nextStatus === "failed") {
        next.errorCode = params.errorCode ?? next.errorCode;
        next.errorMessage = params.errorMessage ?? next.errorMessage;
    }
    else {
        // For non-failed states, clear error fields.
        next.errorCode = undefined;
        next.errorMessage = undefined;
    }
    if (params.nextStatus === "cancelled") {
        next.cancelledReason =
            params.cancelledReason ?? next.cancelledReason;
    }
    else {
        next.cancelledReason = undefined;
    }
    // Use the current status value in the conditional expression to protect
    // against concurrent writers racing to update the same job.
    const expectedStatus = current.status;
    const res = await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: makeJobKey(params.jobId),
        ConditionExpression: "#status = :expectedStatus",
        UpdateExpression: [
            "SET",
            "#status = :status",
            "updated_at = :updatedAt",
            "attempts = :attempts",
            "payload = :payload",
            "last_error_code = :errorCode",
            "last_error_message = :errorMessage",
            "cancelled_reason = :cancelledReason",
        ].join(", "),
        ExpressionAttributeNames: {
            "#status": "status",
        },
        ExpressionAttributeValues: {
            ":expectedStatus": expectedStatus,
            ":status": next.status,
            ":updatedAt": next.updatedAt,
            ":attempts": next.attempt,
            ":payload": next.payload,
            ":errorCode": next.errorCode ?? null,
            ":errorMessage": next.errorMessage ?? null,
            ":cancelledReason": next.cancelledReason ?? null,
        },
        ReturnValues: "ALL_NEW",
    }));
    if (!res.Attributes) {
        throw new Error(`updateJobStatus succeeded but returned no Attributes for job ${params.jobId}`);
    }
    return fromDdbItem(res.Attributes);
}
