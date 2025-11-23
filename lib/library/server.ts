import type {
  LibraryItemSummary,
  LibrarySearchFilters,
} from "./types";
import type { LibraryStoreQuery } from "./store";
import { createPostgresLibraryStore } from "./store-postgres";

export type LibraryStore = {
  list(query: LibraryStoreQuery): Promise<LibraryItemSummary[]>;
  getById(
    workspaceId: string,
    id: string,
  ): Promise<LibraryItemSummary | null>;
};

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

/**
 * Simple in-memory LibraryStore used when Postgres is not yet wired.
 * Mirrors the behavior of the earlier /api/library stub.
 */
function createInMemoryStore(): LibraryStore {
  const nowIso = new Date().toISOString();

  const items: LibraryItemSummary[] = [
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

  return {
    async list(query) {
      const filters = query.filters ?? {};
      if (!Object.keys(filters).length) {
        return items;
      }
      return items.filter((item) => matchesFilters(item, filters));
    },

    async getById(_workspaceId, id) {
      return items.find((i) => i.id === id) ?? null;
    },
  };
}

let storePromise: Promise<LibraryStore> | null = null;

/**
 * Resolve a LibraryStore:
 * - Prefer Postgres-backed store (db.query)
 * - Fall back to in-memory stub if db is missing/misconfigured
 */
export async function getLibraryStore(): Promise<LibraryStore> {
  if (!storePromise) {
    storePromise = (async () => {
      try {
        const dbModule: any = await import("../db/server");
        const db = dbModule?.db ?? dbModule?.default ?? dbModule;

        if (!db || typeof db.query !== "function") {
          throw new Error("db client missing or has no query method");
        }

        return createPostgresLibraryStore({ db });
      } catch (err) {
        console.warn(
          "[library] Falling back to in-memory LibraryStore:",
          err,
        );
        return createInMemoryStore();
      }
    })();
  }

  return storePromise;
}

/**
 * Helper used by /api/library to list items for a workspace with filters.
 */
export async function listLibraryItemsForWorkspace(
  workspaceId: string,
  filters: LibrarySearchFilters = {},
): Promise<{ workspaceId: string; items: LibraryItemSummary[] }> {
  const store = await getLibraryStore();

  const query: LibraryStoreQuery = {
    workspaceId,
    filters,
    limit: 100,
    offset: 0,
    orderBy: "created_at_desc",
  };

  const items = await store.list(query);
  return { workspaceId, items };
}

/**
 * Helper used by /library/[id] and future routes to load a single item by id.
 */
export async function getLibraryItemForWorkspace(
  workspaceId: string,
  id: string,
): Promise<LibraryItemSummary | null> {
  const store = await getLibraryStore();
  return store.getById(workspaceId, id);
}
