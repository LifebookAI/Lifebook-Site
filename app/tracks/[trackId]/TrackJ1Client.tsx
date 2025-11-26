"use client";

import { useState } from "react";
import Link from "next/link";

interface TrackJ1ClientProps {
  trackId: string;
}

export function TrackJ1Client({ trackId }: TrackJ1ClientProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartLab = async () => {
    if (isStarting || hasStarted) return;

    setIsStarting(true);
    setError(null);

    try {
      const res = await fetch("/api/jobs/enqueue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trackId,
          trackTitle: "AWS Foundations – J1",
          stepId: "step-1",
          stepTitle: "Lab 1: S3 private website behind CloudFront OAC",
          templateId: "aws-week1-lab1",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text || "enqueue failed"}`);
      }

      setHasStarted(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error starting job";
      setError(message);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">AWS Foundations – J1</h1>
      <p className="mb-4 text-sm">Week 1 — S3 + CloudFront labs</p>

      <ol className="list-decimal pl-5 space-y-4">
        <li>
          <div className="border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">
                  Lab 1: S3 private website behind CloudFront OAC
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a private S3 bucket, front it with CloudFront via OAC,
                  enable versioning, and configure lifecycle rules.
                </p>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                ~60 min
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  void handleStartLab();
                }}
                disabled={isStarting || hasStarted}
                className="inline-flex items-center rounded border px-3 py-1 text-sm disabled:opacity-60"
              >
                {isStarting
                  ? "Starting…"
                  : hasStarted
                  ? "Started"
                  : "Start lab"}
              </button>

              <div className="text-xs text-muted-foreground">
                {error ? (
                  <span className="text-red-500">
                    Failed to enqueue job: {error}
                  </span>
                ) : hasStarted ? (
                  <span>
                    Job started — check{" "}
                    <Link href="/jobs" className="underline">
                      Jobs
                    </Link>{" "}
                    or your{" "}
                    <Link href="/library/labs" className="underline">
                      Library
                    </Link>{" "}
                    for the artifact.
                  </span>
                ) : (
                  <span>Hit &ldquo;Start lab&rdquo; to enqueue the job.</span>
                )}
              </div>
            </div>
          </div>
        </li>
      </ol>
    </main>
  );
}