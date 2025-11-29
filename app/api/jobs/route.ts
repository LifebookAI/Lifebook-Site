import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { putNewJob } from "../../../services/orchestrator/job-store";
import type { JobRecord } from "../../../services/orchestrator/job-contract";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

// Ensure Node.js runtime (AWS SDKs, crypto, etc.)
export const runtime = "nodejs";

const ORCH_QUEUE_ENV_KEYS = ["LFLBK_ORCH_QUEUE_URL", "ORCHESTRATOR_QUEUE_URL"];
const JOBS_TABLE_ENV_KEYS = ["LFLBK_ORCH_JOBS_TABLE", "JOBS_TABLE_NAME"];
const RUN_LOGS_TABLE_ENV_KEYS = [
  "LFLBK_ORCH_RUN_LOGS_TABLE",
  "RUN_LOGS_TABLE_NAME",
];

// Lazily-created clients (Node runtime)
const sqsClient = new SQSClient({});
const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function getEnvValueFromKeys(keys: string[], friendlyName: string): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  throw new Error(
    `Missing ${friendlyName} env var. Tried: ${keys.join(", ")}`
  );
}

function getQueueUrl(): string {
  return getEnvValueFromKeys(ORCH_QUEUE_ENV_KEYS, "orchestrator queue URL");
}

function getJobsTableName(): string {
  return getEnvValueFromKeys(JOBS_TABLE_ENV_KEYS, "jobs table name");
}

function getRunLogsTableName(): string {
  return getEnvValueFromKeys(
    RUN_LOGS_TABLE_ENV_KEYS,
    "run-logs table name"
  );
}

type CreateJobPayload = {
  workflowSlug: string;
  clientRequestId?: string;
  input?: unknown;
};

type ApiJob = {
  id: string;
  jobId: string;
  workflowSlug: string;
  clientRequestId: string | null;
  status: string;
  input: unknown;
};

function buildApiJob(args: {
  jobId: string;
  workflowSlug?: string;
  clientRequestId?: string | null;
  status?: string;
  input?: unknown;
}): ApiJob {
  const {
    jobId,
    workflowSlug = "sample_hello_world",
    clientRequestId = null,
    status = "queued",
    input = null,
  } = args;

  return {
    id: jobId,
    jobId,
    workflowSlug,
    clientRequestId,
    status,
    input,
  };
}

async function getJobRow(jobId: string): Promise<JobRecord | null> {
  const tableName = getJobsTableName();

  // Try multiple key shapes for backwards compatibility
  const shapes: Array<{ key: Record<string, unknown> }> = [
    { key: { pk: jobId, sk: "job" } },
    { key: { jobId } },
    { key: { job_id: jobId } },
  ];

  for (const shape of shapes) {
    const res = await ddbDocClient.send(
      new GetCommand({
        TableName: tableName,
        Key: shape.key,
      })
    );

    if (res.Item) {
      return res.Item as JobRecord;
    }
  }

  return null;
}

type RunLogRecord = {
  jobId: string;
  createdAt: string;
  level?: string;
  message?: string;
  [key: string]: unknown;
};

async function getRunLogsForJob(
  jobId: string,
  limit = 50
): Promise<RunLogRecord[]> {
  const tableName = getRunLogsTableName();

  const res = await ddbDocClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "jobId = :jobId",
      ExpressionAttributeValues: {
        ":jobId": jobId,
      },
      ScanIndexForward: true, // oldest first
      Limit: limit,
    })
  );

  return (res.Items ?? []) as RunLogRecord[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | CreateJobPayload
      | null;

    if (
      !body ||
      typeof body.workflowSlug !== "string" ||
      !body.workflowSlug.trim()
    ) {
      return NextResponse.json(
        { error: "workflowSlug (string) is required" },
        { status: 400 }
      );
    }

    const workflowSlug = body.workflowSlug.trim();

    // MVP guardrail: we only support the hello-world workflow from this endpoint for now.
    if (workflowSlug !== "sample_hello_world") {
      return NextResponse.json(
        { error: 'Only workflowSlug="sample_hello_world" is supported right now.' },
        { status: 400 }
      );
    }

    // Ensure the worker treats this as a "real" job (see isRealJob in services/orchestrator/src/index.ts)
    const jobId = `job-${randomUUID()}`;
    const clientRequestId = body.clientRequestId ?? randomUUID();
    const input = body.input ?? null;

    const now = new Date().toISOString();

    const jobRecord: JobRecord = {
      jobId,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      attempt: 0,
      payload: {
        workflowSlug,
        triggerType: "manual",
        clientRequestId,
        input,
      },
    };

    // 1) Persist a brand-new job record (idempotent via conditional put)
    await putNewJob(jobRecord);

    // 2) Enqueue a minimal message for the orchestrator worker
    const queueUrl = getQueueUrl();
    const messageBody = JSON.stringify({
      jobId,
      // Future fields (kept simple for now):
      // workflowSlug,
      // triggerType: "manual",
      // outputs: { s3Out: { bucket, key } },
    });

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: messageBody,
      })
    );

    const job = buildApiJob({
      jobId,
      workflowSlug,
      clientRequestId,
      status: jobRecord.status,
      input,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "job queued",
        job,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/jobs error", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET: health check + real job lookup
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const jobId = searchParams.get("jobId");
  const includeLogs = searchParams.get("includeLogs") === "true";
  const workflowSlugFromQuery =
    searchParams.get("workflowSlug") ?? undefined;
  const clientRequestIdFromQuery =
    searchParams.get("clientRequestId") ?? undefined;

  if (!jobId) {
    // Simple health check for /api/jobs without query params
    return NextResponse.json(
      {
        ok: true,
        message: "jobs endpoint live",
      },
      { status: 200 }
    );
  }

  try {
    const jobRecord = await getJobRow(jobId);

    if (!jobRecord) {
      return NextResponse.json(
        { ok: false, error: `Job ${jobId} not found` },
        { status: 404 }
      );
    }

    const payload: any = (jobRecord as any).payload ?? {};

    const workflowSlug =
      workflowSlugFromQuery ??
      (typeof payload.workflowSlug === "string"
        ? payload.workflowSlug
        : "sample_hello_world");

    const clientRequestId =
      clientRequestIdFromQuery ??
      (typeof payload.clientRequestId === "string"
        ? payload.clientRequestId
        : null);

    const input = "input" in payload ? (payload as any).input : null;

    const job = buildApiJob({
      jobId,
      workflowSlug,
      clientRequestId,
      status: jobRecord.status,
      input,
    });

    if (!includeLogs) {
      return NextResponse.json(
        {
          ok: true,
          job,
        },
        { status: 200 }
      );
    }

    const logs = await getRunLogsForJob(jobId);

    return NextResponse.json(
      {
        ok: true,
        job,
        logs,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/jobs error", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

