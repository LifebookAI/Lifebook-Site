export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface Job {
  id: string;
  trackId: string;
  trackTitle: string;
  stepId: string;
  stepTitle: string;
  templateId: string;
  status: JobStatus;
  createdAt: string;
  // For now this is opaque; later we can hang structured results off it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
}

// Simple in-memory store for dev. This resets when the dev server restarts.
const jobs: Job[] = [];

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function enqueueJob(input: {
  trackId: string;
  trackTitle: string;
  stepId: string;
  stepTitle: string;
  templateId: string;
}): Job {
  const job: Job = {
    id: generateJobId(),
    trackId: input.trackId,
    trackTitle: input.trackTitle,
    stepId: input.stepId,
    stepTitle: input.stepTitle,
    templateId: input.templateId,
    status: "queued",
    createdAt: new Date().toISOString(),
  };

  // Newest first
  jobs.unshift(job);
  return job;
}

export function listJobs(): Job[] {
  // Return a shallow copy so callers can't mutate our array directly.
  return [...jobs];
}

export function getJobById(id: string): Job | undefined {
  return jobs.find((job) => job.id === id);
}

export function updateJob(
  id: string,
  updates: Partial<Omit<Job, "id">>,
): Job | undefined {
  const job = getJobById(id);
  if (!job) return undefined;
  Object.assign(job, updates);
  return job;
}