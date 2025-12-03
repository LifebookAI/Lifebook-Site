import { type LibraryItem } from "./catalog";

export type LibraryRun = {
  runId: string;
  libraryItemId: string;
  slug: string;
};

/**
 * startLibraryRunFromItem
 *
 * Thin domain helper used by the Library run API route.
 * For the MVP, this just:
 * - Ensures the item is a workflow template.
 * - Creates a stubbed runId.
 *
 * Later, this becomes the seam where we:
 * - Create a persistent run record in the database.
 * - Enqueue work for the orchestrator.
 * - Emit observability events.
 */
export async function startLibraryRunFromItem(
  item: LibraryItem,
): Promise<LibraryRun> {
  if (item.kind !== "workflow-template") {
    throw new Error(
      "Only workflow-template items are runnable in this MVP. Choose a workflow template.",
    );
  }

  const runId = `run_${item.slug}_${Date.now()}`;

  return {
    runId,
    libraryItemId: item.id,
    slug: item.slug,
  };
}
