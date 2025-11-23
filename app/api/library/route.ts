import { NextResponse } from "next/server";
import type {
  LibraryItemSummary,
  LibraryItemKind,
  LibraryItemSourceType,
  LibrarySearchFilters,
} from "../../../lib/library/types";

/**
 * GET /api/library
 *
 * MVP stub for Personal Library (19B).
 * - Supports basic querystring filters (q, project, tags, kind, sourceType, pinned).
 * - Currently uses in-memory sample data; later we wire this to LibraryStore.
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

function matchesFilters(
  item: LibraryItemSummary,
  filters: LibrarySearchFilters,
): boolean {
  if (filters.pinnedOnly && !item.isPinned) {
    return false;
  }

  if (filters.project && item.project !== filters.project) {
    return false;
  }

  if (filters.tags && filters.tags.length > 0) {
    const hasOverlap = item.tags.some((tag) =>
      filters.tags!.includes(tag),
    );
    if (!hasOverlap) {
      return false;
    }
  }

  if (filters.kind) {
    const kinds = Array.isArray(filters.kind) ? filters.kind : [filters.kind];
    if (!kinds.includes(item.kind)) {
      return false;
    }
  }

  if (filters.sourceType) {
    const sourceTypes = Array.isArray(filters.sourceType)
      ? filters.sourceType
      : [filters.sourceType];
    if (!sourceTypes.includes(item.sourceType)) {
      return false;
    }
  }

  if (filters.query) {
    const needle = filters.query.toLowerCase();
    const haystack = [
      item.title,
      item.project ?? "",
      item.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(needle)) {
      return false;
    }
  }

  return true;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const filters = parseFilters(searchParams);

  // TODO: derive workspaceId from auth/session once available.
  const workspaceId = "demo-workspace";

  const items: LibraryItemSummary[] = [
    {
      id: "example-1",
      title: "Sample workflow run output",
      kind: "workflow_output",
      sourceType: "workflow",
      project: "demo",
      tags: ["sample", "hello-world"],
      isPinned: true,
      createdAt: new Date().toISOString(),
      lastViewedAt: null,
    },
    {
      id: "example-2",
      title: "Capture: S3 lab notes",
      kind: "capture",
      sourceType: "capture",
      project: "aws-foundations",
      tags: ["aws", "study-track"],
      isPinned: false,
      createdAt: new Date().toISOString(),
      lastViewedAt: null,
    },
  ];

  const filtered =
    Object.keys(filters).length === 0
      ? items
      : items.filter((item) => matchesFilters(item, filters));

  return NextResponse.json({ workspaceId, items: filtered });
}
