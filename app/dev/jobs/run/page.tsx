"use client";

import React, { useState, useEffect } from "react";

const CDN_BASE =
  process.env.NEXT_PUBLIC_FILES_BASE_URL || "https://files.uselifebook.ai";

function getResultUrl(jobId: string): string {
  const base = CDN_BASE.replace(/\/$/, "");
  return `${base}/workflows/manual/${jobId}/result.md`;
}

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
  | { ok: true; job: Job; logs?: RunLog[]; error?: undefined }
  | { ok: false; error: string; job?: undefined; logs?: undefined };

type CreateJobResponse =
  | { ok: true; message?: string; job: Job; error?: undefined }
  | { ok: false; error: string; job?: undefined };

const FINAL_STATUSES = ["succeeded", "failed", "cancelled"];

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "<unserializable>";
  }
}

export default function JobsRunnerPage() {
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [includeLogs, setIncludeLogs] = useState(true);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [creating, setCreating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll whenever we have an active job that is not in a final status
  useEffect(() => {
    if (!currentJob) return;

    const jobStatus = status ?? currentJob.status;
    if (FINAL_STATUSES.includes(jobStatus)) {
      setPolling(false);
      return;
    }

    setPolling(true);

    const interval = setInterval(async () => {
      try {
        const params = new URLSearchParams({
          jobId: currentJob.jobId,
          includeLogs: includeLogs ? "true" : "false",
        });

        const res = await fetch(`/api/jobs?${params.toString()}`, {
          method: "GET",
        });

        const data = (await res.json()) as GetJobResponse;

        if (!data.ok) {
          setError(data.error ?? "API reported an error while polling");
          setPolling(false);
          clearInterval(interval);
          return;
        }

        setCurrentJob(data.job);
        setStatus(data.job.status);
        setLogs(data.logs ?? []);

        if (FINAL_STATUSES.includes(data.job.status)) {
          setPolling(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Error polling job status", err);
        setError("Network or runtime error while polling /api/jobs");
        setPolling(false);
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentJob, includeLogs, status]);

  async function handleRunHelloWorld() {
    setError(null);
    setLogs([]);
    setStatus(null);
    setCreating(true);

    try {
      const body = {
        workflowSlug: "sample_hello_world",
        input: {
          from: "dev-runner-ui",
          note: "triggered from /dev/jobs/run",
        },
      };

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as CreateJobResponse;

      if (!data.ok) {
        setError(data.error ?? "API reported an error while creating job");
        return;
      }

      setCurrentJob(data.job);
      setStatus(data.job.status);
    } catch (err) {
      console.error("Error creating job", err);
      setError("Network or runtime error while calling POST /api/jobs");
    } finally {
      setCreating(false);
    }
  }

  const resultUrl = currentJob ? getResultUrl(currentJob.jobId) : null;

  return (
    <main className="min-h-screen px-6 py-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">
        Orchestrator Runner (/dev/jobs/run)
      </h1>
      <p className="text-sm text-gray-500 mb-4">
        Create a new <code>sample_hello_world</code> job via{" "}
        <code>POST /api/jobs</code> and watch its status via{" "}
        <code>GET /api/jobs</code>.
      </p>

      <div className="mb-6 space-y-3">
        <label className="inline-flex items-center space-x-2 text-sm">
          <input
            type="checkbox"
            checked={includeLogs}
            onChange={(e) => setIncludeLogs(e.target.checked)}
          />
          <span>Include logs when polling (includeLogs=true)</span>
        </label>

        <button
          type="button"
          onClick={handleRunHelloWorld}
          disabled={creating}
          className="inline-flex items-center px-4 py-2 text-sm rounded-md border bg-black text-white disabled:opacity-60"
        >
          {creating ? "Creating job…" : "Run sample_hello_world job"}
        </button>

        {currentJob && (
          <p className="text-xs text-gray-500">
            Current jobId:{" "}
            <span className="font-mono">{currentJob.jobId}</span>{" "}
            {polling && <span>(polling…)</span>}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      {currentJob && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Job</h2>
          <div className="text-sm space-y-1">
            <div>
              <span className="font-mono text-gray-500">jobId:</span>{" "}
              <span className="font-mono">{currentJob.jobId}</span>
            </div>
            {currentJob.id && currentJob.id !== currentJob.jobId && (
              <div>
                <span className="font-mono text-gray-500">id:</span>{" "}
                <span className="font-mono">{currentJob.id}</span>
              </div>
            )}
            <div>
              <span className="font-mono text-gray-500">workflowSlug:</span>{" "}
              <span className="font-mono">{currentJob.workflowSlug}</span>
            </div>
            <div>
              <span className="font-mono text-gray-500">status:</span>{" "}
              <span className="font-mono">
                {status ?? currentJob.status}
              </span>
            </div>
            <div>
              <span className="font-mono text-gray-500">
                clientRequestId:
              </span>{" "}
              <span className="font-mono">
                {currentJob.clientRequestId ?? "<null>"}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-1">Input</h3>
            <pre className="text-xs bg-gray-900 text-gray-100 rounded-md px-3 py-2 overflow-x-auto">
              {prettyJson(currentJob.input)}
            </pre>
          </div>

          {resultUrl && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-1">
                Result (CloudFront)
              </h3>
              <p className="text-xs text-gray-500 mb-1">
                For <code>sample_hello_world</code> jobs, the orchestrator
                writes <code>result.md</code> to S3 under{" "}
                <code>workflows/manual/&lt;jobId&gt;/result.md</code>. This is
                the corresponding CloudFront URL.
              </p>
              <a
                href={resultUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 underline break-all"
              >
                {resultUrl}
              </a>
            </div>
          )}
        </section>
      )}

      {includeLogs && currentJob && (
        <section>
          <h2 className="text-lg font-semibold mb-2">
            Logs (jobId={currentJob.jobId})
          </h2>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500">(no logs returned)</p>
          ) : (
            <ul className="space-y-1 text-sm font-mono">
              {logs.map((log, idx) => (
                <li key={idx}>
                  {log.createdAt} [{log.level ?? "info"}]{" "}
                  {log.message ?? ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
