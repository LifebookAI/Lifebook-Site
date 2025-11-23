"use client";

import { useEffect, useState } from "react";
import type {
  CreateJobRequest,
  JobSummary,
  RunLog,
} from "@/lib/jobs/types";

type JobWithLogs = JobSummary & { logs?: RunLog[] };

interface JobsResponse {
  jobs: JobSummary[];
}

interface JobWithLogsResponse {
  job: JobSummary;
  logs?: RunLog[];
}

async function postJob(req: CreateJobRequest): Promise<JobSummary> {
  const res = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `POST /api/jobs failed: ${res.status} ${res.statusText}${
        text ? " - " + text : ""
      }`
    );
  }

  const data = (await res.json()) as unknown;

  if (!data || typeof data !== "object" || !("job" in data)) {
    throw new Error("Unexpected response shape from /api/jobs");
  }

  const { job } = data as JobWithLogsResponse;
  return job;
}

async function fetchJobs(limit = 20): Promise<JobSummary[]> {
  const res = await fetch(`/api/jobs?limit=${limit}`, {
    method: "GET",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `GET /api/jobs failed: ${res.status} ${res.statusText}${
        text ? " - " + text : ""
      }`
    );
  }

  const data = (await res.json()) as unknown;

  if (!data || typeof data !== "object" || !("jobs" in data)) {
    throw new Error("Unexpected response shape from /api/jobs");
  }

  const { jobs } = data as JobsResponse;
  return jobs;
}

async function fetchJobWithLogs(jobId: string): Promise<JobWithLogs> {
  const res = await fetch(
    `/api/jobs?id=${encodeURIComponent(jobId)}&includeLogs=1`,
    {
      method: "GET",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `GET /api/jobs?id=${jobId} failed: ${res.status} ${res.statusText}${
        text ? " - " + text : ""
      }`
    );
  }

  const data = (await res.json()) as unknown;

  if (!data || typeof data !== "object" || !("job" in data)) {
    throw new Error("Unexpected response shape from /api/jobs?id=…");
  }

  const { job, logs } = data as JobWithLogsResponse;
  return { ...job, logs };
}

export function WorkflowsClient() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobWithLogs | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [runInFlight, setRunInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextJobsRaw = await fetchJobs(20);
      // Filter out legacy rows with missing ids so React keys are stable.
      const nextJobs = nextJobsRaw.filter(
        (job) => typeof job.id === "string" && job.id.length > 0
      );
      setJobs(nextJobs);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load jobs";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunSample = async () => {
    setRunInFlight(true);
    setError(null);

    try {
      const clientRequestId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const req: CreateJobRequest = {
        workflowSlug: "sample_hello_world",
        clientRequestId,
        triggerType: "manual",
      };

      const job = await postJob(req);
      setJobs((prev) => [job, ...prev]);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create job";
      setError(message);
    } finally {
      setRunInFlight(false);
    }
  };

  const handleSelectJob = async (jobId: string) => {
    setError(null);
    try {
      const full = await fetchJobWithLogs(jobId);
      setSelectedJob(full);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch job details";
      setError(message);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Workflows</h1>
          <p className="text-sm text-gray-500">
            Run the sample workflow and inspect orchestration state.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void loadJobs();
            }}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
            disabled={isLoading}
          >
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleRunSample();
            }}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
            disabled={runInFlight}
          >
            {runInFlight ? "Running…" : "Run sample"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[2fr,3fr]">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Recent jobs
          </h2>
          <div className="rounded-lg border bg-white">
            {jobs.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">
                No jobs yet. Run the sample workflow to create one.
              </div>
            ) : (
              <ul className="divide-y">
                {jobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void handleSelectJob(job.id);
                      }}
                      className="flex flex-1 items-center justify-between gap-2 text-left"
                    >
                      <div className="space-y-0.5">
                        <div className="font-medium">
                          {job.workflowSlug}
                        </div>
                        <div className="font-mono text-xs">
                          {job.id}
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {job.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Job details
          </h2>
          <div className="rounded-lg border bg-white px-4 py-3 text-sm">
            {!selectedJob ? (
              <div className="text-gray-500">
                Select a job on the left to see details and run logs.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold text-gray-500">
                    Job ID
                  </div>
                  <div className="font-mono text-xs">
                    {selectedJob.id}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-gray-500">
                      Workflow
                    </div>
                    <div>{selectedJob.workflowSlug}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-500">
                      Status
                    </div>
                    <div>{selectedJob.status}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-500">
                      Created
                    </div>
                    <div>{selectedJob.createdAt}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-500">
                      Updated
                    </div>
                    <div>{selectedJob.updatedAt}</div>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-gray-500">
                    Run logs
                  </div>
                  {selectedJob.logs && selectedJob.logs.length > 0 ? (
                    <ul className="space-y-1 text-xs font-mono">
                      {selectedJob.logs.map((log) => (
                        <li key={log.createdAt}>
                          <span className="text-gray-500">
                            {log.createdAt}
                          </span>{" "}
                          —{" "}
                          <span className="font-semibold">
                            {log.step ?? "event"}
                          </span>{" "}
                          <span className="text-gray-700">
                            {log.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-gray-500">
                      No logs yet for this job.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkflowsClient;
