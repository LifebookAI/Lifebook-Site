"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StudyTrack } from "@/lib/study-tracks";

type ProgressState = Record<string, boolean>;

type StudyTrackClientProps = {
  track: StudyTrack;
};

function storageKey(trackId: string) {
  return `lifebook.studyTrack.${trackId}.steps`;
}

export function StudyTrackClient({ track }: StudyTrackClientProps) {
  const [progress, setProgress] = useState<ProgressState>({});

  // Load saved progress on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey(track.id));
      if (raw) {
        const parsed = JSON.parse(raw) as ProgressState;
        setProgress(parsed);
      }
    } catch (err) {
      console.error("Failed to load study track progress", err);
    }
  }, [track.id]);

  // Persist whenever progress changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey(track.id), JSON.stringify(progress));
    } catch (err) {
      console.error("Failed to save study track progress", err);
    }
  }, [track.id, progress]);

  const completedCount = track.steps.filter((step) => progress[step.id]).length;

  function toggleStep(stepId: string) {
    setProgress((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  }

  function markAllDone() {
    const all: ProgressState = {};
    for (const step of track.steps) {
      all[step.id] = true;
    }
    setProgress(all);
  }

  function clearProgress() {
    setProgress({});
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-3">
        <p className="text-xs text-neutral-500">
          <Link href="/tracks" className="underline">
            Study Tracks
          </Link>
          {" / "}
          {track.title}
        </p>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{track.title}</h1>
            <p className="text-sm text-neutral-600">{track.description}</p>
            <p className="text-xs text-neutral-500">
              {completedCount} of {track.steps.length} steps completed
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={markAllDone}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1 text-xs hover:bg-white/10 transition"
            >
              Mark all done
            </button>
            <button
              type="button"
              onClick={clearProgress}
              className="rounded-md border border-white/15 px-3 py-1 text-xs hover:bg-white/10 transition"
            >
              Clear progress
            </button>
          </div>
        </div>
      </header>

      <ol className="space-y-4">
        {track.steps.map((step, index) => {
          const done = !!progress[step.id];

          return (
            <li
              key={step.id}
              className={`border rounded-xl p-4 ${
                done ? "border-emerald-500/70 bg-emerald-950/20" : "border-white/10"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleStep(step.id)}
                      className="h-4 w-4 rounded border-neutral-500 bg-transparent"
                      aria-label={`Toggle completion for ${step.title}`}
                    />
                    <p className="text-xs font-mono text-neutral-500">
                      Step {index + 1}
                    </p>
                  </div>
                  <h2 className="text-base font-semibold">{step.title}</h2>
                  <p className="text-sm text-neutral-300">{step.summary}</p>
                  <p className="text-xs text-neutral-500">
                    Expected artifact: {step.expectedArtifact}
                  </p>
                </div>

                {step.href && (
                  <Link
                    href={step.href as any}
                    className="text-xs font-medium text-blue-400 hover:underline shrink-0"
                  >
                    Open
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

