"use client";

import type { StudyTrack } from "@/lib/tracks/types";
import { StudyTrackDetail } from "@/components/study-track-detail";

interface StudyTrackClientProps {
  track: StudyTrack;
}

export function StudyTrackClient({ track }: StudyTrackClientProps) {
  return <StudyTrackDetail track={track} />;
}
