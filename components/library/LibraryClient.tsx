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
 * - Drives querystring filters (q, pinned) from the UI
 * - Renders a simple list of items with title, kind, project, and tags
 *
 * Later:
 * - Add tag and kind/source filters
 * - Wire to real workspace/auth + LibraryStore (Postgres)
 */
export function LibraryClient() {
  const [items, setItems] = useState<LibraryItemSummary[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();

        if (query.trim()) {
          params.set("q", query.trim());
        }

        if (pinnedOnly) {
          params.set("pinned", "1");
        }

        const qs = params.toString();
        const url = `/api/library${qs ? `?${qs}` : ""}`;

        const res = await fetch(url, { signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as LibraryResponse;

        if (!signal.aborted) {
          setWorkspaceId(data.workspaceId ?? null);
          setItems(data.items ?? []);
        }
      } catch (err) {
        if (signal.aborted) {
          return;
        }
        setError(
          err instanceof Error ? err.message : "Unknown error loading library",
        );
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [query, pinnedOnly]);

  const hasItems = items.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Personal Library
          </h1>
          <p className="text-sm text-gray-400">
            Every saved artifact from your workflows, captures, and notes in one
            place.
          </p>
        </div>

        <form
          className="flex flex-col gap-2 md:flex-row md:items-center"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, project, tags…"
              className="w-56 rounded-md border border-gray-600 bg-white/5 px-2 py-1 text-sm text-gray-100 placeholder:text-gray-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-xs text-gray-400 hover:text-gray-200"
              >
                Clear
              </button>
            )}
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              className="h-3 w-3 rounded border-gray-500 bg-transparent"
              checked={pinnedOnly}
              onChange={(event) => setPinnedOnly(event.target.checked)}
            />
            Pinned only
          </label>
        </form>
      </div>

      {workspaceId && (
        <p className="text-xs text-gray-500">
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

      {!isLoading && !error && !hasItems && (
        <div className="text-sm text-gray-500">
          No items match these filters. Try clearing the search or toggles.
        </div>
      )}

      {!isLoading && !error && hasItems && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-gray-800 bg-slate-900/60 p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-medium leading-snug">
                    {item.title}
                  </h2>
                  {item.project && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      Project:{" "}
                      <span className="font-medium text-gray-200">
                        {item.project}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="inline-flex items-center rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-300">
                    {item.kind}
                  </span>
                  {item.isPinned && (
                    <span className="inline-flex items-center rounded-full bg-yellow-100/10 px-2 py-0.5 text-[10px] font-medium text-yellow-300">
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
                      className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-gray-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <p className="mt-2 text-xs text-gray-500">
                Created: {new Date(item.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
