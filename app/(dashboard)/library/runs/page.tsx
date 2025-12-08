"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RunSummary = {
  jobId: string;
  workflowSlug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string | null;
};

type RunsListResponse = {
  items: RunSummary[];
  error?: string;
};

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function RunsIndexPage() {
  const [items, setItems] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/orchestrator/runs", {
          cache: "no-store",
        });

        const body = (await res.json().catch(() => null)) as RunsListResponse | null;

        if (!res.ok) {
          const msg =
            body && typeof body.error === "string" && body.error
              ? body.error
              : `HTTP ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setItems((body?.items ?? []) as RunSummary[]);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load runs");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-xl font-semibold">Workflow runs</h1>
        <p className="text-sm text-muted-foreground">
          Loading recent runs…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-xl font-semibold">Workflow runs</h1>
        <p className="text-sm text-red-500">Error: {error}</p>
        <p className="text-xs text-muted-foreground">
          Tried to load from <code>/api/orchestrator/runs</code>.
        </p>
      </div>
    );
  }

  const rows = items ?? [];

  return (
    <div className="p-6 space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Workflow runs</h1>
          <p className="text-sm text-muted-foreground">
            Minimal runs index wired to <code>/library/runs/[runId]</code>. Backed
            by live run-detail via <code>/api/orchestrator/runs</code>.
          </p>
        </div>
      </header>

      <section className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No runs to show yet. Once the orchestrator starts writing run metadata,
            this table can list recent runs.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Workflow</th>
                  <th className="px-3 py-2 font-medium">Job ID</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((run) => (
                  <tr key={run.jobId} className="border-b last:border-0">
                    <td className="px-3 py-2 align-top text-xs text-slate-800">
                      <span className="font-mono">{run.workflowSlug}</span>
                    </td>
                    <td className="px-3 py-2 align-top text-xs font-mono break-all text-slate-700">
                      {run.jobId}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-slate-700">
                      {run.status}
                    </td>
                    <td className="px-3 py-2 align-top text-xs font-mono text-slate-600">
                      {formatTs(run.createdAt)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs font-mono text-slate-600">
                      {formatTs(run.updatedAt)}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-right">
                      <Link
                        href={`/library/runs/${encodeURIComponent(run.jobId)}`}
                        className="inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
                      >
                        View run
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}