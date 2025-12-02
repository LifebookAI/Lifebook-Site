/**
 * Library catalog loader
 *
 * Phase 4 / Step 19B — Personal Library (search & recall)
 * This module exposes a typed API for reading the versioned Library catalog
 * from data/library/catalog.v1.json.
 *
 * Intended usage (server-side only):
 *
 *   import { getLibraryItems } from "@/lib/library/catalog";
 *   const items = getLibraryItems();
 *   // use in /api/library or server components
 */

import fs from "node:fs";
import path from "node:path";

export type LibraryItemKind = "workflow-template" | "study-track";

export type LibraryStatus = "draft" | "beta" | "stable";

export interface LibraryItem {
  id: string;
  kind: LibraryItemKind;
  slug: string;
  title: string;
  description: string;
  status: LibraryStatus;
  version: string;
  tags: string[];
}

export interface LibraryCatalog {
  specVersion: string;
  generatedAt?: string;
  items: LibraryItem[];
}

// Resolve the catalog path relative to the project root.
// This assumes the app is started from the repo root (Next.js default).
const catalogPath = path.join(process.cwd(), "data", "library", "catalog.v1.json");

/**
 * Load and validate the Library catalog from disk.
 * Throws if the structure does not match the expected contract.
 */
export function loadLibraryCatalog(): LibraryCatalog {
  const raw = fs.readFileSync(catalogPath, "utf8");
  const parsed = JSON.parse(raw) as LibraryCatalog;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Library catalog JSON did not parse to an object");
  }

  if (!parsed.specVersion) {
    throw new Error("Library catalog is missing specVersion");
  }

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("Library catalog items[] is missing or empty");
  }

  return parsed;
}

/**
 * Convenience helper for callers that only care about the items.
 */
export function getLibraryItems(): LibraryItem[] {
  const catalog = loadLibraryCatalog();
  return catalog.items;
}
