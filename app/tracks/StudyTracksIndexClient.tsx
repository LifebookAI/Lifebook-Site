"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StudyTrack } from "@/lib/study-tracks";

type ProgressState = Record<string, boolean>;

type StudyTracksIndexClientProps = {
  tracks: StudyTrack[];
};

function storageKey(trackId: string) {
  return `lifebook.studyTrack.${trackId}.steps`;
}

export function StudyTracksIndexClient({ tracks }: StudyTracksIndexClientProps) {
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const nextProgress: Record<string, number> = {};

    for (const track of tracks) {
      try {
        const raw = window.localStorage.getItem(storageKey(track.id));
        if (!raw) continue;

        const parsed = JSON.parse(raw) as ProgressState;
        let completed = 0;

        for (const step of track.steps) {
          if (parsed[step.id]) {
            completed += 1;
          }
        }

        if (completed > 0) {
          nextProgress[track.id] = completed;
        }
      } catch (err) {
        console.error("Failed to read progress for study track", err);
      }
    }

    setProgressMap(nextProgress);
  }, [tracks]);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Study Tracks</h1>
        <p className="text-sm text-neutral-400">
          Guided paths that help you ship real artifacts while you learn.
        </p>
      </header>

      <ul className="space-y-4">
        {tracks.map((track) => {
          const completed = progressMap[track.id] ?? 0;
          const total = track.steps.length;
          const hasProgress = completed > 0;
          const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

          return (
            <li key={track.id}>
              <Link
                href={`/tracks/${track.id}`}
                className="block rounded-xl border border-white/10 p-4 hover:border-white/30 hover:bg-white/5 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold underline">
                      {track.title}
                    </h2>
                    <p className="text-sm text-neutral-300">{track.tagline}</p>
                    <p className="text-xs text-neutral-500">
                      {track.level} • Approx. {track.estimatedDurationMinutes} min
                    </p>
                    <p className="text-xs text-neutral-500">{total} steps</p>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-xs text-neutral-400 shrink-0">
                    {hasProgress ? (
                      <>
                        <span>
                          {completed}/{total} steps done
                        </span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full bg-emerald-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <span className="italic text-neutral-500">
                        Not started
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

