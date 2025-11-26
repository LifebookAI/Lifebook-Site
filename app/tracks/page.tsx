import Link from "next/link";
import { getAllTracks } from "@/lib/tracks/registry";

export default function TracksPage() {
  const tracks = getAllTracks();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Study Tracks</h1>
        <p className="text-sm text-muted-foreground">
          Guided journeys that bundle AWS labs and workflows.
        </p>
      </header>

      <ul className="space-y-4">
        {tracks.map((track) => (
          <li
            key={track.id}
            className="rounded-xl border bg-card p-4 text-sm shadow-sm"
          >
            <h2 className="text-base font-medium">{track.title}</h2>
            {track.subtitle && (
              <p className="text-xs text-muted-foreground">{track.subtitle}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {track.description}
            </p>
            <div className="mt-3">
              <Link
                href={`/tracks/${track.slug}`}
                className="inline-flex items-center rounded-full border border-primary bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                View track
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
