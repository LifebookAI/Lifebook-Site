"use client";

import { useEffect, useState } from "react";
import type { LibraryItemSummary } from "../../lib/library/types";

interface LibraryResponse {
  workspaceId: string;
  items: LibraryItemSummary[];
}

type KindFilterValue = "any" | "workflow_output" | "capture";
type SourceTypeFilterValue = "any" | "workflow" | "capture";

/**
 * Personal Library client for MVP (19B).
 * - Fetches from /api/library
 * - Drives querystring filters (q, tags, kind, sourceType, pinned) from the UI
 * - Renders a simple list of items with title, kind, project, and tags
 *
 * Later:
 * - Wire to real workspace/auth + Postgres LibraryStore
 * - Add pagination and more advanced search UX
 */
export function LibraryClient() {
  const [items, setItems] = useState<LibraryItemSummary[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [tags, setTags] = useState("");
  const [kind, setKind] = useState<KindFilterValue>("any");
  const [sourceType, setSourceType] = useState<SourceTypeFilterValue>("any");

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

        if (tags.trim()) {
          const cleaned = tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .join(",");
          if (cleaned) {
            params.set("tags", cleaned);
          }
        }

        if (kind !== "any") {
          params.append("kind", kind);
        }

        if (sourceType !== "any") {
          params.append("sourceType", sourceType);
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
  }, [query, pinnedOnly, tags, kind, sourceType]);

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
          className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center"
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

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Tags (comma-separated)"
              className="w-56 rounded-md border border-gray-600 bg-white/5 px-2 py-1 text-sm text-gray-100 placeholder:text-gray-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            {tags && (
              <button
                type="button"
                onClick={() => setTags("")}
                className="text-xs text-gray-400 hover:text-gray-200"
              >
                Clear tags
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
            <label className="flex items-center gap-1">
              <span className="text-gray-400">Kind</span>
              <select
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as KindFilterValue)
                }
                className="rounded-md border border-gray-600 bg-slate-900 px-2 py-1 text-xs text-gray-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="any">Any</option>
                <option value="workflow_output">Workflow output</option>
                <option value="capture">Capture</option>
              </select>
            </label>

            <label className="flex items-center gap-1">
              <span className="text-gray-400">Source</span>
              <select
                value={sourceType}
                onChange={(event) =>
                  setSourceType(event.target.value as SourceTypeFilterValue)
                }
                className="rounded-md border border-gray-600 bg-slate-900 px-2 py-1 text-xs text-gray-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="any">Any</option>
                <option value="workflow">Workflow</option>
                <option value="capture">Capture</option>
              </select>
            </label>

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-gray-500 bg-transparent"
                checked={pinnedOnly}
                onChange={(event) => setPinnedOnly(event.target.checked)}
              />
              Pinned only
            </label>
          </div>
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

              <div className="mt-2 flex justify-end">
                <a
                  href={`/library/${item.id}`}
                  className="text-xs font-medium text-sky-400 hover:text-sky-300"
                >
                  Open details →
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
