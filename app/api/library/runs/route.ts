import { NextResponse } from "next/server";
import { getRecentLibraryRuns } from "@/lib/orchestrator/library-runs";

/**
 * GET /api/library/runs
 *
 * Minimal MVP endpoint to list recent Library runs from the in-memory
 * orchestrator buffer. This is for local development and will eventually
 * be backed by the orchestrator database.
 */
export async function GET() {
  const runs = getRecentLibraryRuns(20);

  return NextResponse.json(
    {
      ok: true,
      runs: runs.map((run) => ({
        runId: run.runId,
        libraryItemId: run.libraryItemId,
        slug: run.slug,
        status: run.status,
        createdAt: run.createdAt,
      })),
    },
    { status: 200 },
  );
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Use GET /api/library/runs to list recent Library runs.",
    },
    { status: 405 },
  );
}
