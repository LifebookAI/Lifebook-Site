import {
  listLabSessions,
  type LabOutcome,
  type LabSessionResult,
} from '@/lib/labs/sessions';

export type LibraryArtifactKind =
  | 'lab-session'
  | 'capture'
  | 'workflow-output'
  | 'creator-pack';

export interface LabSessionLibraryItem {
  id: string;
  jobId: string;

  artifactKind: 'lab-session';

  templateId: string;
  journeyKey?: string;

  trackTitle: string;
  stepTitle: string;

  completedAt: string;
  outcome: LabOutcome;
  scorePercent?: number;

  summary: string;
}

function toLibraryItem(session: LabSessionResult): LabSessionLibraryItem {
  return {
    id: session.id,
    jobId: session.jobId,
    artifactKind: 'lab-session',
    templateId: session.templateId,
    journeyKey: session.journeyKey,
    trackTitle: session.trackTitle,
    stepTitle: session.stepTitle,
    completedAt: session.completedAt,
    outcome: session.outcome,
    scorePercent: session.scorePercent,
    summary: session.summary,
  };
}

export function getLabSessionLibraryItems(): LabSessionLibraryItem[] {
  const sessions = listLabSessions();

  return sessions
    .slice()
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .map(toLibraryItem);
}