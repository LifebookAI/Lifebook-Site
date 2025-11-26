export type JobForSession = {
  id: string;
  templateId: string;
  journeyKey?: string | null;
  // Arbitrary metadata bag coming from the job store. Values are unknown by design.
  metadata?: Record<string, unknown> | null;
};

export type LabSessionChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type LabSessionOutcome = 'success' | 'partial' | 'failed';

export type LabSession = {
  /** Unique id for this lab session result (for library items). */
  id: string;
  jobId: string;
  templateId: string;
  journeyKey?: string | null;
  trackTitle: string;
  stepTitle: string;
  status: 'completed';
  outcome: LabSessionOutcome;
  scorePercent?: number;
  completedAt: string;
  summary: string;
  checklist: LabSessionChecklistItem[];
};

const sessionsByJobId = new Map<string, LabSession>();

function coerceTitle(raw: unknown, fallback: string): string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return fallback;
}

function getMetaField(
  meta: JobForSession['metadata'],
  key: string,
): unknown {
  if (meta == null) {
    return undefined;
  }
  // meta is now non-null metadata; index directly
  return meta[key];
}

export function createOrUpdateLabSessionFromJob(job: JobForSession): LabSession {
  const rawTrackTitle = getMetaField(job.metadata, 'trackTitle');
  const rawStepTitle = getMetaField(job.metadata, 'stepTitle');

  const trackTitle = coerceTitle(
    rawTrackTitle,
    '(unknown track)',
  );

  const stepTitle = coerceTitle(
    rawStepTitle,
    job.templateId || '(unknown step)',
  );

  // Deterministic fake result for labs
  const outcome: LabSessionOutcome = 'success';
  const scorePercent = 100;

  const nowIso = new Date().toISOString();

  const session: LabSession = {
    // For now, use jobId as the stable id for the session
    id: job.id,
    jobId: job.id,
    templateId: job.templateId,
    journeyKey: job.journeyKey ?? null,
    trackTitle,
    stepTitle,
    status: 'completed',
    outcome,
    scorePercent,
    completedAt: nowIso,
    summary: `Completed lab for ${stepTitle} (${trackTitle}) at ${nowIso}.`,
    checklist: [
      {
        id: 'queued',
        label: 'Job was enqueued',
        done: true,
      },
      {
        id: 'ran',
        label: 'Lab job was run',
        done: true,
      },
      {
        id: 'verified',
        label: 'Result verified in /jobs and /jobs/[jobId]',
        done: true,
      },
    ],
  };

  sessionsByJobId.set(job.id, session);
  return session;
}

export function getLabSessionForJob(jobId: string): LabSession | undefined {
  return sessionsByJobId.get(jobId);
}

export function listLabSessions(): LabSession[] {
  return Array.from(sessionsByJobId.values());
}

/**
 * Back-compat aliases for library code
 */
export type LabOutcome = LabSessionOutcome;
export type LabSessionResult = LabSession;