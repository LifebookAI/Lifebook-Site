import { NextRequest, NextResponse } from "next/server";
import { getLibraryItems } from "@/lib/library/catalog";

/**
 * POST /api/library/[slug]/run
 *
 * Minimal MVP endpoint to start a run from a Library item.
 * For now, we:
 * - Look up the Library item by slug.
 * - Allow only workflow-template items to be "runnable".
 * - Return a stub runId so the client can confirm the flow.
 *
 * In a later step, this will call the real orchestrator pipeline and
 * persist runs in the database.
 */

export async function POST(
  _req: NextRequest,
  context: { params: { slug: string } },
) {
  const slug = context.params.slug;

  const item = getLibraryItems().find((entry) => entry.slug === slug);

  if (!item) {
    return NextResponse.json(
      { ok: false, error: "Library item not found." },
      { status: 404 },
    );
  }

  if (item.kind !== "workflow-template") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Only workflow-template items are runnable in this MVP. Choose a workflow template.",
      },
      { status: 400 },
    );
  }

  // Stubbed run identifier for now. This will be replaced by a real orchestrator call.
  const runId = `run_${slug}_${Date.now()}`;

  return NextResponse.json(
    {
      ok: true,
      runId,
      libraryItemId: item.id,
      slug,
    },
    { status: 200 },
  );
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Use POST /api/library/[slug]/run to start a run from a Library item.",
    },
    { status: 405 },
  );
}
