import Link from "next/link";
import { getAllStudyTracks } from "@/lib/study-tracks";
import { TrackCardProgress } from "./TrackCardProgress";

export const metadata = {
  title: "Study Tracks | Lifebook",
};

export default function StudyTracksPage() {
  const tracks = getAllStudyTracks();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Study Tracks</h1>
        <p className="text-sm text-neutral-400">
          Guided paths that help you ship real artifacts while you learn.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {tracks.map((track) => (
          <Link
            key={track.id}
            href={`/tracks/${track.id}`}
            className="group border border-white/10 rounded-xl p-4 hover:border-sky-500/80 hover:bg-sky-500/5 transition"
          >
            <h2 className="text-lg font-semibold group-hover:text-white">
              {track.title}
            </h2>
            <p className="mt-1 text-sm text-neutral-300">{track.tagline}</p>
            <p className="mt-2 text-xs text-neutral-500">
              {track.level === "beginner" ? "Beginner" : "Intermediate"} · Approx.{" "}
              {track.estimatedDurationMinutes} min
            </p>
            <TrackCardProgress
              trackId={track.id}
              totalSteps={track.steps.length}
            />
          </Link>
        ))}
      </div>
    </main>
  );
}
