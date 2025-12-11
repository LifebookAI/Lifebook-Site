import type { NextRequest } from "next/server";
import { getLibraryRun } from "@/lib/library/runs";

/**
 * Library run detail API for /api/library/runs/[id].
 * ctx.params is async to satisfy typedRoutes.
 */
type LibraryRunsDetailContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _req: NextRequest,
  ctx: LibraryRunsDetailContext,
) {
  try {
    const { id } = await ctx.params;

    const run = await getLibraryRun(id);

    if (!run) {
      return Response.json(
        {
          ok: false,
          error: `No Library run found for id ${id}`,
        },
        { status: 404 },
      );
    }

    return Response.json(
      {
        ok: true,
        run,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load Library run";

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
