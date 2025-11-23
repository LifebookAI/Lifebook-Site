import { NextResponse } from "next/server";
import type { LibraryItemSummary } from "../../../../lib/library/types";
import { getLibraryItemForWorkspace } from "../../../../lib/library/server";

interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * GET /api/library/[id]
 *
 * Returns JSON details for a single Library item.
 * For now, workspaceId is hard-coded to "demo-workspace" until auth/session wiring is in place.
 */
export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const id = context.params.id;
  const workspaceId = "demo-workspace";

  const item: LibraryItemSummary | null = await getLibraryItemForWorkspace(
    workspaceId,
    id,
  );

  if (!item) {
    return NextResponse.json(
      {
        workspaceId,
        id,
        error: "Library item not found",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    workspaceId,
    item,
  });
}
