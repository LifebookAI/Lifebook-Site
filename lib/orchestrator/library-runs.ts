import { type LibraryRun } from "@/lib/library/runs";

/**
 * enqueueLibraryRun
 *
 * Minimal orchestrator seam for Library runs.
 *
 * For the MVP, this is a no-op stub that just logs the run payload on the
 * server so we can see that the flow is hooked up.
 *
 * Later, this will:
 * - Persist the run to the orchestrator database.
 * - Enqueue work onto a queue or job table.
 * - Emit observability events.
 */
export async function enqueueLibraryRun(run: LibraryRun): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("[library-orchestrator] enqueueLibraryRun (MVP stub)", {
    runId: run.runId,
    libraryItemId: run.libraryItemId,
    slug: run.slug,
    status: run.status,
    createdAt: run.createdAt,
  });
}
