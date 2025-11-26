import type { Job } from "@/lib/jobs/store";

export interface LabSession {
  id: string;
  jobId: string;
  trackId: string;
  trackTitle: string;
  stepId: string;
  stepTitle: string;
  templateId: string;
  outcome: string;
  completedAt: string;
  checklist: string[];
}

// Simple in-memory store for dev. This resets when the dev server restarts.
const labSessions: LabSession[] = [];

function generateLabSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createLabSessionFromJob(job: Job): LabSession {
  const session: LabSession = {
    id: generateLabSessionId(),
    jobId: job.id,
    trackId: job.trackId,
    trackTitle: job.trackTitle,
    stepId: job.stepId,
    stepTitle: job.stepTitle,
    templateId: job.templateId,
    outcome: "In progress",
    completedAt: new Date().toISOString(),
    checklist: [
      "Create private S3 bucket",
      "Attach CloudFront OAC to the bucket",
      "Enable S3 versioning",
      "Configure lifecycle rules for versions",
    ],
  };

  // Newest first
  labSessions.unshift(session);
  return session;
}

export function listLabSessions(): LabSession[] {
  return [...labSessions];
}

export function getLabSessionById(id: string): LabSession | undefined {
  return labSessions.find((session) => session.id === id);
}