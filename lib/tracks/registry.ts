import type { StudyTrack, TrackId } from "./types";

const tracks: Record<TrackId, StudyTrack> = {
  "aws-foundations-j1": {
    id: "aws-foundations-j1",
    slug: "aws-foundations-j1",
    title: "AWS Foundations – J1",
    subtitle: "Week 1 – S3 + CloudFront labs",
    description:
      "Guided AWS Foundations track for SAA prep. Start each step to enqueue the matching lab workflow.",
    journeyKey: "aws-foundations-j1",
    steps: [
      {
        id: "lab-1-s3-oac",
        slug: "lab-1-s3-oac",
        title: "Lab 1: S3 private website behind CloudFront OAC",
        summary:
          "Create a private S3 bucket, front it with CloudFront via OAC, enable versioning, and configure lifecycle rules.",
        estimatedMinutes: 60,
        // IMPORTANT: if your orchestrator uses a different template id, change this string to match.
        workflowTemplateId: "aws-lab-1-s3-oac",
      },
    ],
  },
};

export function getAllTracks(): StudyTrack[] {
  return Object.values(tracks);
}

export function getTrackById(id: TrackId): StudyTrack | undefined {
  return tracks[id];
}
