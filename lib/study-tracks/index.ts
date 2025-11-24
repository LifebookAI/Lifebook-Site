import type { StudyTrack } from './types';
import { STUDY_TRACKS } from './data';

export function getAllStudyTracks(): StudyTrack[] {
  return STUDY_TRACKS;
}

export function getStudyTrackById(id: string): StudyTrack | undefined {
  return STUDY_TRACKS.find((track) => track.id === id);
}
export type { StudyTrack } from "./types";

