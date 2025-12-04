import { type LibraryItem } from "./catalog";

export type LibraryRunStatus = "pending" | "running" | "succeeded" | "failed";

export type LibraryRun = {
  runId: string;
  libraryItemId: string;
  slug: string;
  status: LibraryRunStatus;
  createdAt: string;
};

/**
 * startLibraryRunFromItem
 *
 * Thin domain helper used by the Library run API route.
 * For the MVP, this just:
 * - Ensures the item is a workflow template.
 * - Creates a runId.
 * - Marks the run as "pending" with a createdAt timestamp.
 * - Best-effort persists a run row into the jobs table.
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
  const createdAt = new Date().toISOString();

  // Best-effort persistence into jobs table. If the DB is unavailable or misconfigured,
  // we log and continue so the Library run endpoint still behaves for MVP.
  try {
    const { pgQuery } = await import("../j1-db");

    await pgQuery(
      `
        INSERT INTO jobs (run_id, library_item_id, status, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (run_id) DO NOTHING
      `,
      [runId, item.id, "pending"],
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to persist Library job to jobs table", {
      runId,
      libraryItemId: item.id,
      error,
    });
  }

  return {
    runId,
    libraryItemId: item.id,
    slug: item.slug,
    status: "pending",
    createdAt,
  };
}
