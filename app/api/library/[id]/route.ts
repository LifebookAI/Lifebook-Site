import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Stub GET handler for /api/library/[id].
 * Keeps CI green while the real Library backend is still under construction.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return NextResponse.json(
    {
      ok: false,
      id,
      message:
        "Library item endpoint not implemented yet (stubbed for MVP CI build).",
    },
    { status: 501 }
  );
}