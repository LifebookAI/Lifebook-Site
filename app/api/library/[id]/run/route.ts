import type { NextRequest } from "next/server";
import { getLibraryRun, startLibraryRunFromItem } from "@/lib/library/runs";

/**
 * Library run API for /api/library/[id]/run.
 * typedRoutes expects params to be async, so ctx.params is a Promise.
 */
type LibraryRunRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _req: NextRequest,
  ctx: LibraryRunRouteContext,
) {
  try {
    const { id } = await ctx.params;

    const run = await startLibraryRunFromItem(id);

    return Response.json(
      {
        ok: true,
        run,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start Library run";

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET(
  _req: NextRequest,
  ctx: LibraryRunRouteContext,
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
