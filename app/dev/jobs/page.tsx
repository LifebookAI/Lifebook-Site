"use client";

import { useState } from "react";

type Job = {
  id?: string;
  jobId: string;
  workflowSlug: string;
  clientRequestId: string | null;
  status: string;
  input: unknown;
};

type RunLog = {
  jobId: string;
  createdAt: string;
  level?: string;
  message?: string;
  [key: string]: unknown;
};

type GetJobResponse =
  | {
      ok: true;
      job: Job;
      logs?: RunLog[];
      error?: undefined;
    }
  | {
      ok: false;
      error: string;
      job?: undefined;
      logs?: undefined;
    };

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "<unserializable>";
  }
}

export default function JobsInspectorPage() {
  const [jobId, setJobId] = useState("");
  const [includeLogs, setIncludeLogs] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<GetJobResponse | null>(null);

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = jobId.trim();
    if (!trimmed) {
      setError("jobId is required");
      setResponse(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const params = new URLSearchParams({
        jobId: trimmed,
        includeLogs: includeLogs ? "true" : "false",
      });

      const res = await fetch(`/api/jobs?${params.toString()}`, {
        method: "GET",
      });

      const data = (await res.json()) as GetJobResponse;

      if (!data.ok) {
        setError(data.error ?? "API reported an error");
        setResponse(data);
        return;
      }

      setResponse(data);
    } catch (err) {
      console.error("Error fetching job status", err);
      setError("Network or runtime error while calling /api/jobs");
    } finally {
      setLoading(false);
    }
  }

  const job = response && response.ok ? response.job : null;
  const logs = response && response.ok ? response.logs ?? [] : [];

  return (
    <main className="min-h-screen px-6 py-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Jobs Inspector (/dev/jobs)</h1>
      <p className="text-sm text-gray-500 mb-6">
        Paste a <code>job-…</code> id from the orchestrator smoke or CLI helper
        and fetch its current status via <code>GET /api/jobs</code>.
      </p>

      <form onSubmit={handleFetch} className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Job ID</label>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="job-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
          />
        </div>

        <label className="inline-flex items-center space-x-2 text-sm">
          <input
            type="checkbox"
            checked={includeLogs}
            onChange={(e) => setIncludeLogs(e.target.checked)}
          />
          <span>Include logs (includeLogs=true)</span>
        </label>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 text-sm rounded-md border bg-black text-white disabled:opacity-60"
          >
            {loading ? "Fetching…" : "Fetch job"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      {job && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Job</h2>
          <div className="text-sm space-y-1">
            <div>
              <span className="font-mono text-gray-500">jobId:</span>{" "}
              <span className="font-mono">{job.jobId}</span>
            </div>
            {job.id && job.id !== job.jobId && (
              <div>
                <span className="font-mono text-gray-500">id:</span>{" "}
                <span className="font-mono">{job.id}</span>
              </div>
            )}
            <div>
              <span className="font-mono text-gray-500">workflowSlug:</span>{" "}
              <span className="font-mono">{job.workflowSlug}</span>
            </div>
            <div>
              <span className="font-mono text-gray-500">status:</span>{" "}
              <span className="font-mono">{job.status}</span>
            </div>
            <div>
              <span className="font-mono text-gray-500">clientRequestId:</span>{" "}
              <span className="font-mono">
                {job.clientRequestId ?? "<null>"}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-1">Input</h3>
            <pre className="text-xs bg-gray-900 text-gray-100 rounded-md px-3 py-2 overflow-x-auto">
              {prettyJson(job.input)}
            </pre>
          </div>
        </section>
      )}

      {includeLogs && (
        <section>
          <h2 className="text-lg font-semibold mb-2">
            Logs {job ? `(jobId=${job.jobId})` : ""}
          </h2>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500">(no logs returned)</p>
          ) : (
            <ul className="space-y-1 text-sm font-mono">
              {logs.map((log, idx) => (
                <li key={idx}>
                  {log.createdAt} [{log.level ?? "info"}] {log.message ?? ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
