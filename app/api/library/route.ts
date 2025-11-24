/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Stub GET handler for /api/library.
 * Keeps CI green while the real Library backend is still under construction.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      items: [],
      message:
        "Library collection endpoint not implemented yet (stubbed for MVP CI build).",
    },
    { status: 501 }
  );
}

