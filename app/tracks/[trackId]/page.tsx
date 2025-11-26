import { notFound } from "next/navigation";
import { getTrackById } from "@/lib/tracks/registry";
import type { TrackId } from "@/lib/tracks/types";
import { StudyTrackClient } from "./StudyTrackClient";

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const { trackId } = await params;
  const track = getTrackById(trackId as TrackId);

  if (!track) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <StudyTrackClient track={track} />
    </main>
  );
}
