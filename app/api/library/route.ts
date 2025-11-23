import { NextResponse } from "next/server";
import type { LibrarySearchFilters } from "../../../lib/library/types";
import type { LibraryStoreQuery } from "../../../lib/library/store";
import { createMemoryLibraryStore } from "../../../lib/library/store-memory";

/**
 * GET /api/library
 *
 * MVP Personal Library route (19B).
 * - Parses querystring filters into LibrarySearchFilters
 * - Delegates listing to LibraryStore (currently memory-backed)
 * - Returns { workspaceId, items[] }
 */

function parseFilters(searchParams: URLSearchParams): LibrarySearchFilters {
  const filters: LibrarySearchFilters = {};

  const q = searchParams.get("q");
  if (q && q.trim()) {
    filters.query = q.trim();
  }

  const project = searchParams.get("project");
  if (project && project.trim()) {
    filters.project = project.trim();
  }

  const pinned = searchParams.get("pinned");
  if (pinned === "1" || pinned === "true") {
    filters.pinnedOnly = true;
  }

  const tagsParam = searchParams.get("tags");
  if (tagsParam) {
    const tags = tagsParam
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length > 0) {
      filters.tags = tags;
    }
  }

  const kindParams = searchParams.getAll("kind");
  if (kindParams.length === 1) {
    filters.kind = kindParams[0] as any;
  } else if (kindParams.length > 1) {
    filters.kind = kindParams as any;
  }

  const sourceTypeParams = searchParams.getAll("sourceType");
  if (sourceTypeParams.length === 1) {
    filters.sourceType = sourceTypeParams[0] as any;
  } else if (sourceTypeParams.length > 1) {
    filters.sourceType = sourceTypeParams as any;
  }

  return filters;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const filters = parseFilters(searchParams);

  // TODO: derive workspaceId from auth/session once available.
  const workspaceId = "demo-workspace";

  const store = createMemoryLibraryStore({});
  const query: LibraryStoreQuery = {
    workspaceId,
    filters,
    limit: 50,
    offset: 0,
    orderBy: "created_at_desc",
  };

  const items = await store.list(query);

  return NextResponse.json({ workspaceId, items });
}
