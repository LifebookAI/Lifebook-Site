export type ParsedLibraryRunId = {
  runId: string;
  slug: string;
  libraryItemId: string;
  status: "pending";
  createdAt: Date | null;
};

/**
 * parseLibraryRunId
 *
 * MVP convention:
 *   run_<slug>_<timestampMs>
 *
 * Example:
 *   run_hello-library_1764811216425
 */
export function parseLibraryRunId(rawRunId: string): ParsedLibraryRunId | null {
  let decoded = rawRunId;

  try {
    decoded = decodeURIComponent(rawRunId);
  } catch {
    // Fall back to the raw value if decodeURIComponent fails.
  }

  if (!decoded.startsWith("run_")) {
    return null;
  }

  const withoutPrefix = decoded.slice("run_".length);
  const lastUnderscore = withoutPrefix.lastIndexOf("_");

  if (lastUnderscore === -1) {
    return null;
  }

  const slug = withoutPrefix.slice(0, lastUnderscore);
  const timestampPart = withoutPrefix.slice(lastUnderscore + 1);

  const timestampMs = Number(timestampPart);
  const createdAt =
    Number.isFinite(timestampMs) && timestampMs > 0
      ? new Date(timestampMs)
      : null;

  const libraryItemId = `workflow.${slug}`;

  return {
    runId: decoded,
    slug,
    libraryItemId,
    status: "pending",
    createdAt,
  };
}
