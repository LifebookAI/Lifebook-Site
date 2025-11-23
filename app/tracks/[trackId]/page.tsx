import { notFound } from 'next/navigation';
import { getAllStudyTracks, getStudyTrackById } from '@/lib/study-tracks';
import { StudyTrackDetail } from '@/components/study-track-detail';

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

  return <StudyTrackDetail track={track} />;
}
