"use client";

import { useState } from "react";

export default function LibraryRunInspectorPage() {
  const [runIdInput, setRunIdInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = runIdInput.trim();
    if (!trimmed) {
      setError("Please paste a runId to inspect.");
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(
        `/api/dev/library/run-from-id?runId=${encodeURIComponent(trimmed)}`,
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || !json || json.ok === false) {
        const message =
          (json && json.error) ||
          `Request failed with HTTP ${res.status}.`;

        setError(message);
        setResult(null);
        return;
      }

      setResult(JSON.stringify(json, null, 2));
    } catch (err) {
      console.error(err);
      setError("Unexpected error while calling run-from-id API.");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Library run inspector
        </h1>
        <p className="max-w-xl text-sm text-slate-500">
          Dev-only helper. Paste a Library run ID (e.g.
          {" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
            run_hello-library_1764811216425
          </code>
          ) to reconstruct its payload via the run-from-id API.
        </p>
        <p className="max-w-xl text-xs text-slate-400">
          This tool trusts the MVP convention
          {" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
            run_{"<slug>"}_{"<timestampMs>"}
          </code>
          . In the full orchestrator, runs will be loaded from the jobs
          database instead.
        </p>
      </header>

      <section className="space-y-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label
              htmlFor="runId"
              className="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Run ID
            </label>
            <input
              id="runId"
              name="runId"
              type="text"
              value={runIdInput}
              onChange={(e) => setRunIdInput(e.target.value)}
              placeholder="run_hello-library_1764811216425"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? "Inspecting…" : "Inspect run"}
          </button>
        </form>

        {error && (
          <div className="max-w-xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="max-w-3xl space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              API response
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg border border-slate-200 bg-slate-950 px-3 py-2 text-[11px] leading-relaxed text-slate-100">
              {result}
            </pre>
          </div>
        )}
      </section>
    </main>
  );
}
