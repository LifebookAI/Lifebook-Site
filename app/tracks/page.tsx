import Link from 'next/link';
import { getAllStudyTracks } from '@/lib/study-tracks';

export const metadata = {
  title: 'Study Tracks | Lifebook',
};

export default function StudyTracksPage() {
  const tracks = getAllStudyTracks();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Study Tracks</h1>
        <p className="text-sm text-neutral-600">
          Guided paths that help you ship real artifacts while you learn.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {tracks.map((track) => (
          <Link
            key={track.id}
            href={`/tracks/${track.id}`}
            className="border rounded-xl p-4 hover:border-blue-500 transition"
          >
            <h2 className="text-lg font-semibold">{track.title}</h2>
            <p className="mt-1 text-sm text-neutral-600">{track.tagline}</p>
            <p className="mt-2 text-xs text-neutral-500">
              {track.level === 'beginner' ? 'Beginner' : 'Intermediate'} · Approx. {track.estimatedDurationMinutes} min
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
