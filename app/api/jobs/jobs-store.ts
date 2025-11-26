import { randomUUID } from "node:crypto";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Job {
  id: string;
  templateId: string;
  journeyKey?: string;
  metadata?: Record<string, unknown>;
  input?: unknown;
  status: JobStatus;
  createdAt: string;
}

export type JobsPostBody = {
  templateId?: string;
  workflowTemplateId?: string;
  journeyKey?: string;
  metadata?: Record<string, unknown>;
  input?: unknown;
};

const inMemoryJobs: Job[] = [];

export function getJobs(): Job[] {
  return inMemoryJobs;
}

export function enqueueJob(body: JobsPostBody): Job {
  const templateId = body.templateId ?? body.workflowTemplateId;

  if (!templateId) {
    throw new Error("templateId or workflowTemplateId is required");
  }

  const job: Job = {
    id: randomUUID(),
    templateId,
    journeyKey: body.journeyKey,
    metadata: body.metadata,
    input: body.input,
    status: "queued",
    createdAt: new Date().toISOString(),
  };

  inMemoryJobs.push(job);
  return job;
}
