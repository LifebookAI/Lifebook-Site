'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StudyTrack } from '@/lib/study-tracks/types';

type Props = {
  track: StudyTrack;
};

type ProgressMap = Record<string, boolean>;

function getStorageKey(trackId: string) {
  return `lifebook:study-track:${trackId}:steps`;
}

export function StudyTrackDetail({ track }: Props) {
  const [completed, setCompleted] = useState<ProgressMap>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(getStorageKey(track.id));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setCompleted(parsed);
      }
    } catch {
      // ignore bad data
    }
  }, [track.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(getStorageKey(track.id), JSON.stringify(completed));
    } catch {
      // ignore storage errors (e.g., private mode)
    }
  }, [track.id, completed]);

  const totalSteps = track.steps.length;
  const completedSteps = track.steps.filter((step) => completed[step.id]).length;

  function toggleStep(stepId: string) {
    setCompleted((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  }

  function markAllDone() {
    const all: ProgressMap = {};
    for (const step of track.steps) {
      all[step.id] = true;
    }
    setCompleted(all);
  }

  function clearProgress() {
    setCompleted({});
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <p className="text-xs text-neutral-500">
          <Link href="/tracks" className="underline">
            Study Tracks
          </Link>
          {' / '}
          {track.title}
        </p>
        <h1 className="text-2xl font-semibold">{track.title}</h1>
        <p className="text-sm text-neutral-600">{track.description}</p>
        <p className="text-xs text-neutral-500">
          {completedSteps} of {totalSteps} steps completed
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={markAllDone}
            className="rounded border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10"
          >
            Mark all done
          </button>
          <button
            type="button"
            onClick={clearProgress}
            className="rounded border border-white/15 bg-transparent px-2 py-1 hover:bg-white/10"
          >
            Clear progress
          </button>
        </div>
      </header>

      <ol className="space-y-4">
        {track.steps.map((step, index) => {
          const isDone = !!completed[step.id];
          return (
            <li
              key={step.id}
              className={`border rounded-xl p-4 ${
                isDone ? 'border-emerald-500/60 bg-emerald-500/5' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-mono text-neutral-500">
                    Step {index + 1}
                  </p>
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <span>{step.title}</span>
                    {isDone && (
                      <span className="inline-flex items-center rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        Done
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-neutral-600">{step.summary}</p>
                  <p className="text-xs text-neutral-500">
                    Expected artifact: {step.expectedArtifact}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {step.href && (
                    <Link
                      href={step.href as any}
                      className="text-xs font-medium text-blue-500 hover:underline"
                    >
                      Open
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleStep(step.id)}
                    className="text-[11px] rounded border border-white/15 bg-white/5 px-2 py-1 text-neutral-100 hover:bg-white/10"
                  >
                    {isDone ? 'Mark not done' : 'Mark done'}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

