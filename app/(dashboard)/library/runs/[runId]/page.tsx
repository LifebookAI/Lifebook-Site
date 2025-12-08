"use client";

import React, { useEffect, useState } from "react";

type RunLogEntry = {
  jobId: string;
  step: string;
  message: string;
  statusBefore?: string | null;
  statusAfter?: string | null;
  createdAt: string;
};

type RunDetailResponse = {
  jobId: string;
  workflowSlug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string | null;
  runLogs: RunLogEntry[];
  error?: string;
};

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = React.use(params);

  const [data, setData] = useState<RunDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/orchestrator/run-detail/${encodeURIComponent(runId)}`,
          {
            cache: "no-store",
          }
        );

        const body = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            body && typeof body.error === "string" && body.error
              ? body.error
              : `HTTP ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(body as RunDetailResponse);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load run detail");
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
  }, [runId]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Run detail</h1>
        <p className="text-sm text-muted-foreground">
          Loading run <code className="text-xs">{runId}</code>…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Run detail</h1>
        <p className="text-sm text-red-500 mb-2">Error: {error}</p>
        <p className="text-xs text-muted-foreground">
          Tried to load <code>{runId}</code> from{" "}
          <code>/api/orchestrator/run-detail/{runId}</code>.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Run detail</h1>
        <p className="text-sm text-muted-foreground">
          No data returned for run <code>{runId}</code>.
        </p>
      </div>
    );
  }

  const statusColor =
    data.status === "succeeded"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : data.status === "failed"
      ? "bg-red-100 text-red-700 border-red-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Run detail:{" "}
            <span className="font-mono text-base">
              {data.workflowSlug ?? "(unknown workflow)"}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Job ID:{" "}
            <span className="font-mono text-xs break-all">{data.jobId}</span>
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusColor}`}
          >
            Status: {data.status}
          </span>
          <div className="text-xs text-muted-foreground space-y-0.5 text-right">
            <div>
              Created:{" "}
              <span className="font-mono">{formatTs(data.createdAt)}</span>
            </div>
            <div>
              Updated:{" "}
              <span className="font-mono">{formatTs(data.updatedAt)}</span>
            </div>
          </div>
        </div>
      </header>

      {data.lastError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-semibold mb-1">Last error</div>
          <pre className="whitespace-pre-wrap text-xs font-mono">
            {data.lastError}
          </pre>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">
          Run log timeline
        </h2>

        {(!data.runLogs || data.runLogs.length === 0) && (
          <p className="text-sm text-muted-foreground">
            No run-log entries recorded for this run.
          </p>
        )}

        {data.runLogs && data.runLogs.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Step</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {data.runLogs.map((log) => {
                  const statusSegment =
                    log.statusBefore && log.statusAfter
                      ? `${log.statusBefore} → ${log.statusAfter}`
                      : log.statusAfter ?? "";

                  return (
                    <tr
                      key={`${log.step}-${log.createdAt}-${log.jobId}`}
                      className="border-b last:border-0"
                    >
                      <td className="px-3 py-2 align-top text-xs font-mono text-slate-600">
                        {formatTs(log.createdAt)}
                      </td>
                      <td className="px-3 py-2 align-top text-xs font-mono text-slate-800">
                        {log.step}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-slate-700">
                        {statusSegment}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-slate-800">
                        {log.message}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}