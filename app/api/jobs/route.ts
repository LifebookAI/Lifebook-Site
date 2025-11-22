import { NextRequest, NextResponse } from "next/server";
import type { CreateJobRequest, JobSummary } from "@/lib/jobs/types";

/**
 * Jobs mode:
 *  - "stub" (default): in-memory dev jobs for sample_hello_world only.
 *  - "live": reserved for real orchestrator wiring (currently returns 501).
 */
const JOBS_MODE = process.env.LIFEBOOK_JOBS_MODE ?? "stub";

/**
 * Dev-only stub data for the sample workflow.
 * This will be replaced by a real DB-backed implementation when the
 * orchestrator wiring is connected.
 */
const DEV_SAMPLE_JOBS: JobSummary[] = [
  {
    jobId: "dev-sample-1",
    workflowKey: "sample_hello_world",
    status: "succeeded",
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workflowKey = searchParams.get("workflowKey");

  if (!workflowKey) {
    return NextResponse.json(
      { error: "workflowKey query param is required" },
      { status: 400 },
    );
  }

  if (JOBS_MODE !== "stub") {
    return NextResponse.json(
      {
        error:
          "Live job listing is not implemented yet. Set LIFEBOOK_JOBS_MODE=stub for dev stub data.",
      },
      { status: 501 },
    );
  }

  if (workflowKey !== "sample_hello_world") {
    return NextResponse.json(
      { jobs: [] as JobSummary[] },
      { status: 200 },
    );
  }

  // Most recent first
  const jobs = [...DEV_SAMPLE_JOBS].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return NextResponse.json(
    { jobs },
    { status: 200 },
  );
}

/**
 * POST /api/jobs
 *
 * Contract:
 *  - Body: { workflowKey, triggerType, input?, idempotencyKey? }
 *  - Response (stub mode): { jobId }
 *
 * In "stub" mode this only creates an in-memory job for local dev.
 * In "live" mode this will later be wired to the orchestrator (DB row + enqueue).
 */
export async function POST(req: NextRequest) {
  let body: CreateJobRequest | undefined;

  try {
    const json = await req.json();
    body = json as CreateJobRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body?.workflowKey || !body?.triggerType) {
    return NextResponse.json(
      { error: "workflowKey and triggerType are required" },
      { status: 400 },
    );
  }

  if (JOBS_MODE !== "stub") {
    // Explicitly fail in live mode until orchestrator wiring is implemented.
    return NextResponse.json(
      {
        error:
          "Job creation not wired to orchestrator yet. Set LIFEBOOK_JOBS_MODE=stub for dev stub runs.",
      },
      { status: 501 },
    );
  }

  const now = new Date().toISOString();
  const jobId = `dev-${body.workflowKey}-${Date.now().toString(36)}`;

  const job: JobSummary = {
    jobId,
    workflowKey: body.workflowKey,
    status: "succeeded",
    createdAt: now,
    updatedAt: now,
  };

  DEV_SAMPLE_JOBS.unshift(job);
  if (DEV_SAMPLE_JOBS.length > 10) {
    DEV_SAMPLE_JOBS.length = 10;
  }

  return NextResponse.json(
    { jobId },
    { status: 201 },
  );
}
