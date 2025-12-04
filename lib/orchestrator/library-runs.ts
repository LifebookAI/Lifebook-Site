import { type LibraryRun } from "@/lib/library/runs";

/**
 * In-memory buffer of Library runs for local dev / MVP.
 *
 * This is intentionally ephemeral and node-process local. In the full
 * orchestrator this will be backed by the jobs database / queue instead.
 */
const inMemoryRuns: LibraryRun[] = [];

/**
 * getRecentLibraryRuns
 *
 * Returns the most recent Library runs, sorted by createdAt descending.
 * For now this is a simple in-memory view for local development.
 */
export function getRecentLibraryRuns(limit = 20): LibraryRun[] {
  if (inMemoryRuns.length === 0) {
    return [];
  }

  const sorted = [...inMemoryRuns].sort((a, b) => {
    const aTime = new Date(a.createdAt as any).getTime();
    const bTime = new Date(b.createdAt as any).getTime();

    if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
      return 0;
    }

    return bTime - aTime;
  });

  if (limit <= 0) {
    return [];
  }

  return sorted.slice(0, limit);
}

/**
 * enqueueLibraryRun
 *
 * Minimal orchestrator seam for Library runs.
 *
 * For the MVP, this:
 * - Buffers the run in an in-memory list for use in the Library activity view.
 * - Logs the run payload on the server so we can see that the flow is hooked up.
 *
 * Later, this will:
 * - Persist the run to the orchestrator database.
 * - Enqueue work onto a queue or job table.
 * - Emit observability events.
 */
export async function enqueueLibraryRun(run: LibraryRun): Promise<void> {
  // Keep most recent first, and cap buffer size so it doesn't grow unbounded.
  inMemoryRuns.unshift(run);
  if (inMemoryRuns.length > 100) {
    inMemoryRuns.length = 100;
  }

  // eslint-disable-next-line no-console
  console.log("[library-orchestrator] enqueueLibraryRun (MVP stub)", {
    runId: run.runId,
    libraryItemId: run.libraryItemId,
    slug: run.slug,
    status: run.status,
    createdAt: run.createdAt,
  });
}
