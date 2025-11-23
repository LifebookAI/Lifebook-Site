/**
 * lib/library/store-memory.ts
 *
 * In-memory implementation of the LibraryStore for MVP/demo.
 * Uses a small sample set and full filter logic so the UI + route
 * exercise the same shape as a real store (e.g., Postgres).
 */

import type {
  LibraryItemSummary,
  LibrarySearchFilters,
} from "./types";
import type { CreateLibraryStore, LibraryStoreQuery } from "./store";

const nowIso = new Date().toISOString();

const SAMPLE_ITEMS: LibraryItemSummary[] = [
  {
    id: "example-1",
    title: "Sample workflow run output",
    kind: "workflow_output",
    sourceType: "workflow",
    project: "demo",
    tags: ["sample", "hello-world"],
    isPinned: true,
    createdAt: nowIso,
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
    createdAt: nowIso,
    lastViewedAt: null,
  },
];

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

export const createMemoryLibraryStore: CreateLibraryStore = () => {
  return {
    async list(query: LibraryStoreQuery) {
      const filters = query.filters ?? {};
      let results = SAMPLE_ITEMS.slice();

      if (Object.keys(filters).length > 0) {
        results = results.filter((item) => matchesFilters(item, filters));
      }

      const orderBy = query.orderBy ?? "created_at_desc";

      results = results.slice().sort((a, b) => {
        const aCreated = new Date(a.createdAt).getTime();
        const bCreated = new Date(b.createdAt).getTime();

        switch (orderBy) {
          case "created_at_asc":
            return aCreated - bCreated;
          case "created_at_desc":
          default:
            return bCreated - aCreated;
        }
      });

      const offset = query.offset ?? 0;
      const limit = query.limit ?? 50;

      return results.slice(offset, offset + limit);
    },

    async getById(_workspaceId: string, id: string) {
      const found = SAMPLE_ITEMS.find((item) => item.id === id);
      return found ?? null;
    },
  };
};
