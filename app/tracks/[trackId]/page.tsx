import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllStudyTracks, getStudyTrackById } from '@/lib/study-tracks';

type TrackPageProps = {
  params: {
    trackId: string;
  };
};

export function generateStaticParams() {
  const tracks = getAllStudyTracks();
  return tracks.map((track) => ({ trackId: track.id }));
}

export default function StudyTrackPage({ params }: TrackPageProps) {
  const track = getStudyTrackById(params.trackId);
  if (!track) {
    notFound();
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
      </header>

      <ol className="space-y-4">
        {track.steps.map((step, index) => (
          <li key={step.id} className="border rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-mono text-neutral-500">
                  Step {index + 1}
                </p>
                <h2 className="text-base font-semibold">{step.title}</h2>
                <p className="text-sm text-neutral-600">{step.summary}</p>
                <p className="text-xs text-neutral-500">
                  Expected artifact: {step.expectedArtifact}
                </p>
              </div>
              {step.href && (
                <Link
                  href={step.href}
                  className="text-xs font-medium text-blue-600 hover:underline shrink-0"
                >
                  Open
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
