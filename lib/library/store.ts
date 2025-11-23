/**
 * lib/library/store.ts
 *
 * Read-only store contract for the Personal Library (19B).
 * This file defines how the rest of the app asks for Library data.
 * It deliberately does NOT bind to a specific DB client.
 */

import type {
  LibraryItemSummary,
  LibrarySearchFilters,
} from "./types";

/**
 * Supported sort orders for Library listings.
 */
export type LibrarySortOrder =
  | "created_at_desc"
  | "created_at_asc"
  | "last_viewed_desc"
  | "last_viewed_asc";

/**
 * Query parameters for listing/searching Library items.
 */
export interface LibraryStoreQuery {
  workspaceId: string;
  filters?: LibrarySearchFilters;
  limit?: number;
  offset?: number;
  orderBy?: LibrarySortOrder;
}

/**
 * Minimal read-only store contract for the Library.
 * Mutations (create/update/pin) will be added in a later step once
 * the initial read path is wired and stable.
 */
export interface LibraryStore {
  /**
   * List/search Library items for a workspace.
   * Implementations should apply workspaceId + filters + sort + pagination.
   */
  list(query: LibraryStoreQuery): Promise<LibraryItemSummary[]>;

  /**
   * Fetch a single Library item by id, scoped by workspace.
   * Returns null if not found or not visible to the caller.
   */
  getById(workspaceId: string, id: string): Promise<LibraryItemSummary | null>;
}

/**
 * Factory contract for creating a LibraryStore from infrastructure dependencies.
 * The concrete implementation can live in a separate module (e.g. lib/library/store-postgres.ts)
 * and use this type as its public surface.
 */
export type CreateLibraryStore = (deps: {
  // Replace "unknown" with your actual DB client type when wiring.
  db: unknown;
}) => LibraryStore;
