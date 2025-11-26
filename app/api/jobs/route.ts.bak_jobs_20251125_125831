/**
 * Temporary stub for /api/jobs during orchestrator scaffolding.
 * Avoids hard dependency on JOBS_TABLE_NAME in CI / Next 15 build.
 * Replace with the real implementation once the jobs store is wired.
 */

import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Jobs API is not configured yet in this environment.",
    },
    { status: 503 },
  );
}

