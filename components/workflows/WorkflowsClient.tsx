"use client";

import React, { useState } from "react";
import { WORKFLOW_TEMPLATES } from "@/workflows/registry";
import type { WorkflowKey } from "@/workflows/types";

type RunStatus = "idle" | "running" | "success" | "error";
type RunState = Partial<Record<WorkflowKey, RunStatus>>;

export function WorkflowsClient() {
  const [runState, setRunState] = useState<RunState>({});
  const [message, setMessage] = useState<string | null>(null);

  async function handleRun(key: WorkflowKey) {
    setRunState((prev) => ({ ...prev, [key]: "running" }));
    setMessage(null);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowKey: key,
          triggerType: "manual",
          idempotencyKey: `ui-${key}-${Date.now()}`,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as
        | { jobId: string }
        | { error: string }
        | Record<string, never>;

      if (res.ok && "jobId" in data) {
        setRunState((prev) => ({ ...prev, [key]: "success" }));
        setMessage(`Job ${data.jobId} created for ${key}.`);
        return;
      }

      if (res.status === 501) {
        setRunState((prev) => ({ ...prev, [key]: "error" }));
        setMessage(
          "Jobs API not fully wired to orchestrator yet (501). This is expected if backend wiring is incomplete."
        );
        return;
      }

      const errorText =
        "error" in data && typeof data.error === "string"
          ? data.error
          : "Failed to create job. Please try again.";
      setRunState((prev) => ({ ...prev, [key]: "error" }));
      setMessage(errorText);
    } catch (err) {
      console.error("[lifebook] Error calling /api/jobs", err);
      setRunState((prev) => ({ ...prev, [key]: "error" }));
      setMessage("Network error while creating job.");
    }
  }

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
          their job runs.
        </p>
      </div>

      {message && (
        <p className="text-xs text-slate-400" data-testid="workflow-message">
          {message}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {WORKFLOW_TEMPLATES.map((wf) => {
          const status = runState[wf.key] ?? "idle";
          const isRunning = status === "running";

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

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleRun(wf.key)}
                  disabled={isRunning}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRunning
                    ? "Running…"
                    : wf.key === "sample_hello_world"
                    ? "Run sample"
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

export default WorkflowsClient;
