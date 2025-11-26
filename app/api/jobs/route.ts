import { NextRequest, NextResponse } from "next/server";
import { enqueueJob, getJobs, type JobsPostBody } from "./jobs-store";

export function GET() {
  return NextResponse.json({ jobs: getJobs() });
}

export async function POST(req: NextRequest) {
  let body: JobsPostBody;

  try {
    body = (await req.json()) as JobsPostBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  try {
    const job = enqueueJob(body);

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        job,
      },
      { status: 201 },
    );
  } catch (err) {
    const message =
      err &&
      typeof err === "object" &&
      "message" in err &&
      typeof (err as { message?: unknown }).message === "string"
        ? ((err as { message?: unknown }).message as string)
        : "Failed to enqueue job";

    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}
