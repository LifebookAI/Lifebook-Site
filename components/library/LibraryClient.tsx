"use client";

import { useEffect, useState } from "react";
import type { LibraryItemSummary } from "../../lib/library/types";

interface LibraryResponse {
  workspaceId: string;
  items: LibraryItemSummary[];
}

/**
 * Basic Personal Library client for MVP (19B).
 * - Fetches from /api/library
 * - Renders a simple list of items with title, kind, project, and tags
 * Later we can:
 * - Add filters (query/tags)
 * - Wire to real workspace/auth + LibraryStore
 */
export function LibraryClient() {
  const [items, setItems] = useState<LibraryItemSummary[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/library");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as LibraryResponse;

        if (!cancelled) {
          setWorkspaceId(data.workspaceId ?? null);
          setItems(data.items ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unknown error loading library",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Personal Library</h1>
        <p className="text-sm text-gray-500">
          Every saved artifact from your workflows, captures, and notes in one place.
        </p>
      </div>

      {workspaceId && (
        <p className="text-xs text-gray-400">
          Workspace: <span className="font-mono">{workspaceId}</span>
        </p>
      )}

      {isLoading && (
        <div className="text-sm text-gray-500">Loading your Library…</div>
      )}

      {error && !isLoading && (
        <div className="text-sm text-red-500">
          Failed to load Library: {error}
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="text-sm text-gray-500">
          No items yet. Once your workflows and captures start saving artifacts,
          they&apos;ll show up here.
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-medium leading-snug">
                    {item.title}
                  </h2>
                  {item.project && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      Project: <span className="font-medium">{item.project}</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                    {item.kind}
                  </span>
                  {item.isPinned && (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-800">
                      Pinned
                    </span>
                  )}
                </div>
              </div>

              {item.tags && item.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <p className="mt-2 text-xs text-gray-400">
                Created: {new Date(item.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
