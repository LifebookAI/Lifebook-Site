import { NextResponse } from "next/server";
import { parseLibraryRunId } from "@/lib/orchestrator/run-id";

/**
 * GET /api/dev/library/run-from-id?runId=...
 *
 * Dev-only helper to reconstruct a Library run payload from its runId.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  if (!runId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing runId query parameter.",
      },
      { status: 400 },
    );
  }

  const parsed = parseLibraryRunId(runId);

  if (!parsed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to parse runId. Expected format: run_<slug>_<timestampMs>.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      run: {
        runId: parsed.runId,
        slug: parsed.slug,
        libraryItemId: parsed.libraryItemId,
        status: parsed.status,
        createdAt: parsed.createdAt ? parsed.createdAt.toISOString() : null,
      },
    },
    { status: 200 },
  );
}
