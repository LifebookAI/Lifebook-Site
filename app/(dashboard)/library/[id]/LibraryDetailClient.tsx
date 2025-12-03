"use client";

import { useState } from "react";

type LibraryDetailClientProps = {
  slug: string;
  primaryCtaLabel: string;
  primaryCtaHint: string;
  isRunnable: boolean;
};

type RunSummary = {
  runId: string;
  status: string;
  createdAtDisplay: string;
};

export function LibraryDetailClient({
  slug,
  primaryCtaLabel,
  primaryCtaHint,
  isRunnable,
}: LibraryDetailClientProps) {
  const [status, setStatus] = useState<"idle" | "running" | "ok" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

  async function handleClick() {
    if (!isRunnable) {
      setStatus("idle");
      setRunSummary(null);
      setMessage(
        "Track enrollment isn't wired up yet in this MVP. For now, use this page as a reference for what the track covers.",
      );
      return;
    }

    setStatus("running");
    setRunSummary(null);
    setMessage("Starting run from this Library item...");

    try {
      const res = await fetch(`/api/library/${slug}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // ignore JSON parse errors, we will handle below
      }

      if (!res.ok || !json?.ok) {
        setStatus("error");
        setRunSummary(null);
        setMessage(
          json?.error ??
            "Something went wrong starting this run. Please try again.",
        );
        return;
      }

      // Safely derive run metadata for display
      const rawRunId = json.runId;
      const runId =
        typeof rawRunId === "string" && rawRunId.trim().length > 0
          ? rawRunId
          : String(rawRunId ?? "").trim() || "(missing runId)";

      const rawStatus = json.status;
      const statusText =
        typeof rawStatus === "string" && rawStatus.trim().length > 0
          ? rawStatus
          : "pending";

      const rawCreatedAt = json.createdAt;
      let createdAtDisplay = "just now";

      if (rawCreatedAt) {
        try {
          const d = new Date(rawCreatedAt);
          if (!Number.isNaN(d.getTime())) {
            createdAtDisplay = d.toLocaleString();
          }
        } catch {
          // fall back to default "just now"
        }
      }

      setStatus("ok");
      setRunSummary({
        runId,
        status: statusText,
        createdAtDisplay,
      });
      setMessage(
        "Run started from this Library item. In the MVP, this run will eventually appear in your Library activity and workspace.",
      );
    } catch {
      setStatus("error");
      setRunSummary(null);
      setMessage(
        "Network error starting run. Check your connection and try again.",
      );
    }
  }

  const buttonLabel = status === "running" ? "Starting..." : primaryCtaLabel;

  return (
    <section className="space-y-4">
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 shadow-sm shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md hover:shadow-slate-900/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
        onClick={handleClick}
        disabled={status === "running"}
      >
        {buttonLabel}
      </button>
      <p className="max-w-xl text-xs text-slate-500">{primaryCtaHint}</p>
      {message && (
        <p className="max-w-xl text-xs text-slate-500">{message}</p>
      )}
      {runSummary && (
        <div className="max-w-xl rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
          <p className="font-mono">
            <span className="font-semibold">Run ID:</span> {runSummary.runId}
          </p>
          <p className="font-mono">
            <span className="font-semibold">Status:</span> {runSummary.status}
          </p>
          <p className="font-mono">
            <span className="font-semibold">Created at:</span>{" "}
            {runSummary.createdAtDisplay}
          </p>
        </div>
      )}
    </section>
  );
}
