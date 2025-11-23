import { NextResponse } from "next/server";
import type {
  LibrarySearchFilters,
  LibraryItemKind,
  LibraryItemSourceType,
} from "../../../lib/library/types";
import { listLibraryItemsForWorkspace } from "../../../lib/library/server";

/**
 * GET /api/library
 *
 * Personal Library API (MVP, read-only).
 * - Parses querystring filters (q, project, tags, kind, sourceType, pinned)
 * - Delegates to LibraryStore (Postgres when available; otherwise in-memory stub)
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
    filters.kind = kindParams[0] as LibraryItemKind;
  } else if (kindParams.length > 1) {
    filters.kind = kindParams as LibraryItemKind[];
  }

  const sourceTypeParams = searchParams.getAll("sourceType");
  if (sourceTypeParams.length === 1) {
    filters.sourceType = sourceTypeParams[0] as LibraryItemSourceType;
  } else if (sourceTypeParams.length > 1) {
    filters.sourceType = sourceTypeParams as LibraryItemSourceType[];
  }

  return filters;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = parseFilters(url.searchParams);

  // TODO: derive workspaceId from auth/session once available.
  const workspaceId = "demo-workspace";

  const { items } = await listLibraryItemsForWorkspace(workspaceId, filters);

  return NextResponse.json({ workspaceId, items });
}
