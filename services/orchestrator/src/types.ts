export type JobMessage = {
  jobId: string;
  idemKey?: string;
  workspaceId?: string;
  userId?: string;
  inputs: {
    url?: string;
    text?: string;
    s3Put?: { bucket: string; key: string; body?: string };
  };
  outputs?: {
    s3Out?: { bucket: string; key: string };
    notion?: { title: string; pageId?: string };
  };
};
export type RunResult = {
  jobId: string;
  runId: string;
  ok: boolean;
  summary?: string;
  s3Key?: string;
  notionPageId?: string;
  logs: string[];
};