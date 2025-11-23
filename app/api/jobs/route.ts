import { NextRequest, NextResponse } from "next/server";
import type { CreateJobRequest } from "@/lib/jobs/types";
import {
  createJob,
  getJobById,
  listRecentJobs,
} from "@/lib/jobs/store-dynamo";
import { listRunLogs } from "@/lib/jobs/run-logs-dynamo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function logError(context: string, error: unknown) {
  const safeError =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { error };
  console.error(context, safeError);
}

export async function POST(req: NextRequest) {
  let body: CreateJobRequest;

  try {
    body = (await req.json()) as CreateJobRequest;
  } catch (error: unknown) {
    logError("Failed to parse POST /api/jobs body", error);
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const workflowSlug = body.workflowSlug ?? body.workflowKey;
  if (!workflowSlug) {
    return NextResponse.json(
      { error: "Missing workflowSlug" },
      { status: 400 }
    );
  }

  try {
    const job = await createJob({ ...body, workflowSlug });
    // Contract: POST returns { job: JobSummary }
    return NextResponse.json({ job }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    logError("Failed to create job", error);
    // Include a non-secret, human-readable detail for the UI
    return NextResponse.json(
      { error: "Failed to create job", detail: message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const limitParam = searchParams.get("limit");
  const includeLogs = searchParams.get("includeLogs") === "1";
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;

  try {
    if (id) {
      const job = await getJobById(id);
      if (!job) {
        return NextResponse.json(
          { error: "Job not found" },
          { status: 404 }
        );
      }

      if (includeLogs) {
        const logs = await listRunLogs(id);
        // When includeLogs=1 we return { job, logs }
        return NextResponse.json({ job, logs });
      }

      // Existing contract: { job: JobSummary }
      return NextResponse.json({ job });
    }

    const jobs = await listRecentJobs(
      Number.isFinite(limit) && limit > 0 ? limit : 50
    );

    // Existing contract: { jobs: JobSummary[] }
    return NextResponse.json({ jobs });
  } catch (error: unknown) {
    logError("Failed to fetch jobs", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}
