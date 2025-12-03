import { NextRequest, NextResponse } from "next/server";
import { getLibraryItems } from "@/lib/library/catalog";
import { startLibraryRunFromItem } from "@/lib/library/runs";

/**
 * POST /api/library/[id]/run
 *
 * Minimal MVP endpoint to start a run from a Library item.
 * For now, we:
 * - Look up the Library item by slug (from the [id] segment).
 * - Delegate to startLibraryRunFromItem for workflow-template items.
 *
 * In a later step, this will call the real orchestrator pipeline and
 * persist runs in the database.
 */

export async function POST(
  _req: NextRequest,
  context: { params: { id: string } },
) {
  const slug = context.params.id;

  const item = getLibraryItems().find((entry) => entry.slug === slug);

  if (!item) {
    return NextResponse.json(
      { ok: false, error: "Library item not found." },
      { status: 404 },
    );
  }

  try {
    const run = await startLibraryRunFromItem(item);

    return NextResponse.json(
      {
        ok: true,
        runId: run.runId,
        libraryItemId: run.libraryItemId,
        slug: run.slug,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to start run from this Library item.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Use POST /api/library/[id]/run to start a run from a Library item.",
    },
    { status: 405 },
  );
}
