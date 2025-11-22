"use client";

import React, { useCallback, useEffect, useState } from "react";
import { WORKFLOW_TEMPLATES } from "@/workflows/registry";
import type { WorkflowKey } from "@/workflows/types";
import type { JobStatus, JobSummary } from "@/lib/jobs/types";

type RunState = "idle" | "running" | "error";

const SAMPLE_WORKFLOW_KEY: WorkflowKey = "sample_hello_world";

export default function WorkflowsClient() {
  const [runState, setRunState] = useState<RunState>("idle");
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    setJobsError(null);

    try {
      const params = new URLSearchParams({
        workflowKey: SAMPLE_WORKFLOW_KEY,
      });

      const res = await fetch(`/api/jobs?${params.toString()}`, {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error(`Failed to load jobs (status ${res.status})`);
      }

      const data = (await res.json()) as { jobs: JobSummary[] };
      setJobs(data.jobs ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load jobs.";
      setJobsError(message);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  async function handleRunSample() {
    setRunState("running");
    setRunMessage(null);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflowKey: SAMPLE_WORKFLOW_KEY,
          triggerType: "manual",
          idempotencyKey: `sample-${Date.now()}`,
        }),
      });

      if (res.status === 501) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;

        setRunState("error");
        setRunMessage(
          data?.error ??
            "Job creation endpoint is not wired to the orchestrator yet (501).",
        );
        return;
      }

      if (!res.ok) {
        setRunState("error");
        setRunMessage(`Run failed with status ${res.status}.`);
        return;
      }

      setRunState("idle");
      setRunMessage("Job request accepted. (Dev stub: no real worker yet.)");
      await fetchJobs();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to run workflow.";
      setRunState("error");
      setRunMessage(message);
    }
  }

  function renderJobStatus(status: JobStatus) {
    switch (status) {
      case "queued":
        return "Queued";
      case "running":
        return "Running";
      case "succeeded":
        return "Succeeded";
      case "failed":
        return "Failed";
      default:
        return status;
    }
  }

  const latestJob = jobs[0];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Workflows</h2>
        <p className="text-sm text-slate-300">
          Define and run automations that call the orchestrator. Each workflow
          is a template that maps inputs into jobs, with idempotent execution
          and run logs.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Step 19 (MVP): this surface wires manual, schedule, and webhook
          triggers for flagship workflows into the orchestrator and surfaces
          their job runs here. For now, the Sample workflow uses a dev stub
          behind /api/jobs.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {WORKFLOW_TEMPLATES.map((wf) => {
          const isSample = wf.key === SAMPLE_WORKFLOW_KEY;

          return (
            <article
              key={wf.key}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-4"
            >
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-50">
                  {wf.name}
                </h3>
                <p className="text-xs text-slate-300">{wf.description}</p>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                  <span className="rounded-full border border-slate-700 px-2 py-0.5">
                    Default: {wf.defaultTrigger}
                  </span>
                  {wf.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-800 px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                {isSample ? (
                  <div className="flex flex-col gap-1 text-[11px] text-slate-400">
                    {jobsLoading && <span>Loading recent runs…</span>}
                    {jobsError && !jobsLoading && (
                      <span className="text-red-400">
                        Failed to load runs: {jobsError}
                      </span>
                    )}
                    {!jobsLoading && !jobsError && latestJob && (
                      <span>
                        Latest run: {renderJobStatus(latestJob.status)} at{" "}
                        {new Date(latestJob.createdAt).toLocaleTimeString()}
                      </span>
                    )}
                    {runMessage && (
                      <span
                        className={
                          runState === "error"
                            ? "text-red-400"
                            : "text-slate-300"
                        }
                      >
                        {runMessage}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    Run wiring for this workflow is coming later in Step 19.
                  </span>
                )}

                <button
                  type="button"
                  onClick={isSample ? handleRunSample : undefined}
                  disabled={!isSample || runState === "running"}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    isSample
                      ? "bg-slate-100 text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      : "cursor-not-allowed bg-slate-800 text-slate-400"
                  }`}
                  title={
                    isSample
                      ? "Send a sample job to /api/jobs (dev stub)."
                      : "Run wiring for this workflow is coming later in Step 19."
                  }
                >
                  {isSample
                    ? runState === "running"
                      ? "Running…"
                      : "Run sample"
                    : "Run (coming later)"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
