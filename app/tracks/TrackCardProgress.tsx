"use client";

import { useEffect, useState } from "react";

type TrackCardProgressProps = {
  trackId: string;
  totalSteps: number;
};

type ProgressState = Record<string, boolean>;

function storageKey(trackId: string) {
  return `lifebook.studyTrack.${trackId}.steps`;
}

export function TrackCardProgress({ trackId, totalSteps }: TrackCardProgressProps) {
  const [completed, setCompleted] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(storageKey(trackId));
      if (!raw) {
        setCompleted(0);
        return;
      }
      const parsed = JSON.parse(raw) as ProgressState;
      const doneCount = Object.values(parsed).filter(Boolean).filter(Boolean).length;
      setCompleted(doneCount);
    } catch (err) {
      console.error("Failed to load study track card progress", err);
      setCompleted(0);
    }
  }, [trackId, totalSteps]);

  if (completed === null) {
    // Don’t flash anything before hydration
    return null;
  }

  const allDone = completed >= totalSteps;
  const hasAny  = completed > 0;

  let text: string;
  if (allDone) {
    text = "All steps completed";
  } else if (hasAny) {
    text = `${completed} of ${totalSteps} steps completed`;
  } else {
    text = `${totalSteps} steps`;
  }

  return (
    <p className="mt-2 text-xs text-neutral-400">
      {text}
    </p>
  );
}
