import Link from "next/link";
import { TrackJ1Client } from "./TrackJ1Client";

interface TrackParams {
  trackId: string;
}

interface TrackPageProps {
  params: Promise<TrackParams>;
}

export default async function TrackPage({ params }: TrackPageProps) {
  const { trackId } = await params;

  // For now we only have one concrete track wired up.
  if (trackId !== "aws-foundations-j1") {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4">Track not found</h1>
        <p className="text-sm">
          Track <code>{trackId}</code> is not configured yet.
        </p>
        <p className="mt-4 text-sm">
          Go back to{" "}
          <Link href="/tracks" className="underline">
            Tracks
          </Link>
          .
        </p>
      </main>
    );
  }

  return <TrackJ1Client trackId={trackId} />;
}