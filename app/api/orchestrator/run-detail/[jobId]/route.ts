import type { NextRequest } from "next/server";
import { getRunDetail } from "@/lib/orchestrator/runDetail";

/**
 * Orchestrator run detail API for /api/orchestrator/run-detail/[jobId].
 * ctx.params is async to satisfy typedRoutes.
 */
type OrchestratorRunDetailContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(
  _req: NextRequest,
  ctx: OrchestratorRunDetailContext,
) {
  try {
    const { jobId } = await ctx.params;

    const detail = await getRunDetail(jobId);

    if (!detail) {
      return Response.json(
        {
          ok: false,
          error: `No orchestrator run found for jobId ${jobId}`,
        },
        { status: 404 },
      );
    }

    return Response.json(
      {
        ok: true,
        run: detail,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load orchestrator run detail";

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
