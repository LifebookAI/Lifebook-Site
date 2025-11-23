import { getAllStudyTracks } from "@/lib/study-tracks";
import { StudyTracksIndexClient } from "./StudyTracksIndexClient";

export default function StudyTracksPage() {
  const tracks = getAllStudyTracks();
  return <StudyTracksIndexClient tracks={tracks} />;
}
