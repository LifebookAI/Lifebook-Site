"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StudyTrack, StudyTrackStep } from "@/lib/tracks/types";

interface Props {
  track: StudyTrack;
}

type StepStatus = "idle" | "starting" | "started" | "error";

type ErrorResponse = {
  error?: unknown;
};

export function StudyTrackDetail({ track }: Props) {
  const [statusByStep, setStatusByStep] = useState<Record<string, StepStatus>>(
    {},
  );
  const [errorByStep, setErrorByStep] = useState<Record<string, string | null>>(
    {},
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleStart(step: StudyTrackStep) {
    if (!step.workflowTemplateId) {
      return;
    }

    setStatusByStep((prev) => ({ ...prev, [step.id]: "starting" }));
    setErrorByStep((prev) => ({ ...prev, [step.id]: null }));

    const payload = {
      // Support both the old and new API contracts
      templateId: step.workflowTemplateId,
      workflowTemplateId: step.workflowTemplateId,
      journeyKey: step.journeyKey ?? track.journeyKey,
      metadata: {
        trackId: track.id,
        trackSlug: track.slug,
        stepId: step.id,
        stepSlug: step.slug,
        trackTitle: track.title,
        stepTitle: step.title,
      },
    };

    try {
      const res = await fetch("/api/jobs/enqueue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = "Failed to start step.";

        try {
          const data = (await res.json()) as unknown;

          if (data && typeof data === "object") {
            const errorLike = data as ErrorResponse;
            if (typeof errorLike.error === "string") {
              // Common case: { "error": "Some message" }
              message = errorLike.error;
            } else {
              // Fallback: stringify the whole response so we can see what the API sent
              message = JSON.stringify(
                data as Record<string, unknown>,
                null,
                2,
              );
            }
          }
        } catch {
          // ignore JSON parse errors
        }

        // Prefix with HTTP status code for context, e.g. "400 {...}"
        message = `${res.status} ${message}`;

        setStatusByStep((prev) => ({ ...prev, [step.id]: "error" }));
        setErrorByStep((prev) => ({ ...prev, [step.id]: message }));
        return;
      }

      setStatusByStep((prev) => ({ ...prev, [step.id]: "started" }));
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setStatusByStep((prev) => ({ ...prev, [step.id]: "error" }));
      setErrorByStep((prev) => ({
        ...prev,
        [step.id]: "Unexpected error starting step.",
      }));
    }
  }

  function getLabel(step: StudyTrackStep): string {
    const status = statusByStep[step.id] ?? "idle";
    if (!step.workflowTemplateId) return "No workflow linked";
    if (status === "starting") return "Starting…";
    if (status === "started") return "Started";
    if (status === "error") return "Retry";
    return "Start step";
  }

  function isDisabled(step: StudyTrackStep): boolean {
    const status = statusByStep[step.id] ?? "idle";
    if (!step.workflowTemplateId) return true;
    return status === "starting" || isPending;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {track.title}
        </h1>
        {track.subtitle && (
          <p className="text-sm text-muted-foreground">{track.subtitle}</p>
        )}
        <p className="text-sm text-muted-foreground">{track.description}</p>
      </header>

      <ol className="space-y-3">
        {track.steps.map((step, index) => {
          const status = statusByStep[step.id] ?? "idle";
          const error = errorByStep[step.id];

          return (
            <li
              key={step.id}
              className="rounded-xl border bg-card p-3 text-sm shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <h2 className="text-base font-medium">{step.title}</h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  ~{step.estimatedMinutes} min
                </span>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                {step.summary}
              </p>

              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => void handleStart(step)}
                  disabled={isDisabled(step)}
                  className="inline-flex items-center justify-center rounded-full border border-primary bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {getLabel(step)}
                </button>
                {status === "started" && (
                  <span className="text-[11px] text-emerald-600">
                    Job started — check Jobs or your Library for the artifact.
                  </span>
                )}
              </div>

              {error && (
                <p className="mt-1 whitespace-pre-wrap text-[11px] text-red-600">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
