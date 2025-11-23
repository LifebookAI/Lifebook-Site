/**
 * lib/library/types.ts
 *
 * Type-level contract for the Personal Library (19B).
 * Mirrors db/migrations/20251108_library.sql (library_items table).
 * No runtime database wiring here — just shapes for API + UI.
 */

export type LibraryItemKind =
  | "workflow_output"
  | "capture"
  | "note"
  | "other";

export type LibraryItemSourceType =
  | "workflow"
  | "capture"
  | "manual"
  | "import";

/**
 * Raw row shape as it comes back from the database.
 * UUIDs + timestamps are represented as strings (ISO) at the edge.
 */
export interface LibraryItemRow {
  id: string;
  workspaceId: string;
  userId: string | null;
  artifactId: string | null;

  title: string;
  kind: LibraryItemKind;
  sourceType: LibraryItemSourceType;
  sourceId: string | null;
  project: string | null;

  tags: string[];

  isPinned: boolean;
  pinnedAt: string | null;
  lastViewedAt: string | null;

  createdAt: string;
  updatedAt: string;

  searchText: string | null;
  // searchVector is DB-only; client code never touches it directly.
}

/**
 * Minimal shape used for listing/search results in the UI.
 * Can be extended later with badges, score, etc.
 */
export interface LibraryItemSummary {
  id: string;
  title: string;
  kind: LibraryItemKind;
  sourceType: LibraryItemSourceType;
  project?: string | null;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  lastViewedAt?: string | null;
}

/**
 * Filters for basic search & recall operations.
 * Implementation lives in the store later (19B wiring).
 */
export interface LibrarySearchFilters {
  query?: string;
  tags?: string[];
  kind?: LibraryItemKind | LibraryItemKind[];
  sourceType?: LibraryItemSourceType | LibraryItemSourceType[];
  project?: string;
  pinnedOnly?: boolean;
}
