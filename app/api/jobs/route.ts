import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { putNewJob } from "../../../services/orchestrator/job-store";
import type { JobRecord } from "../../../services/orchestrator/job-contract";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// Ensure Node.js runtime (AWS SDKs, crypto, etc.)
export const runtime = "nodejs";

const ORCH_QUEUE_ENV_KEYS = ["LFLBK_ORCH_QUEUE_URL", "ORCHESTRATOR_QUEUE_URL"];

// Lazily-created SQS client (Node runtime)
const sqsClient = new SQSClient({});

function getQueueUrl(): string {
  for (const key of ORCH_QUEUE_ENV_KEYS) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  throw new Error(
    `No orchestrator queue URL env var set (${ORCH_QUEUE_ENV_KEYS.join(
      ", "
    )}).`
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as CreateJobPayload | null;

    if (!body || typeof body.workflowSlug !== "string" || !body.workflowSlug.trim()) {
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
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET remains a lightweight stub for now; we will tighten this to read real job
// status + logs later, but existing smokes can keep using the current shape.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const jobId = searchParams.get("jobId");
  const includeLogs = searchParams.get("includeLogs") === "true";
  const workflowSlug = searchParams.get("workflowSlug") ?? "sample_hello_world";
  const clientRequestId = searchParams.get("clientRequestId");

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

  const job = buildApiJob({
    jobId,
    workflowSlug,
    clientRequestId: clientRequestId ?? null,
    input: null,
  });

  if (includeLogs) {
    const logs = [
      {
        id: randomUUID(),
        jobId,
        level: "info",
        message: "stub log for orchestrator smoke",
        createdAt: new Date().toISOString(),
      },
    ];

    return NextResponse.json(
      {
        ok: true,
        job,
        logs,
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      job,
    },
    { status: 200 }
  );
}
