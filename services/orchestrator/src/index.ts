import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { emitAnalytics } from "./analytics.js";
import { httpGet } from "./steps/http.js";
import { filePut } from "./steps/file.js";
import { summarize } from "./steps/text.js";
import { exportToNotion } from "./steps/notion.js";
import { recordRun, getByIdemKey, saveIdem } from "./ddb.js";
import { runId as newRunId } from "./util.js";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.LF_ORCH_QUEUE_URL!;
const TABLE = process.env.LF_ORCH_TABLE || "lifebook-orchestrator-jobs";

export async function handler(): Promise<void> {
  const msg = await sqs.send(new ReceiveMessageCommand({ QueueUrl: QUEUE_URL, MaxNumberOfMessages: 1, WaitTimeSeconds: 5 }));
  if (!msg.Messages?.length) return;
  const m = msg.Messages[0];
  const body = JSON.parse(m.Body!);
  const job = body as import("./types.js").JobMessage;

  emitAnalytics("workflow_run_started",{ job_id: job.jobId, workspace_id: job.workspaceId, user_id: job.userId });

  if (job.idemKey) {
    const prev = await getByIdemKey(job.idemKey);
    if (prev) {
      // deduplicated (no-op analytics)
      await sqs.send(new DeleteMessageCommand({ QueueUrl: QUEUE_URL, ReceiptHandle: m.ReceiptHandle! }));
      return;
    }
  }

  const runId = newRunId();
  const logs: string[] = [];
  const log = (s: string) => { logs.push(s); console.log(s); };

  try {
    emitAnalytics("workflow_run_started",{ job_id: job.jobId, workspace_id: job.workspaceId, user_id: job.userId });

    let source = job.inputs.text || "";
    if (!source && job.inputs.url) {
      source = await httpGet(job.inputs.url); log(`Fetched URL (${source.length} bytes)`);
    }

    const summary = await summarize(source); log(`Summarized (${summary.length} chars)`);
    

    let s3Key: string | undefined;
    if (job.outputs?.s3Out) {
      const md = `# Workflow Result\n\n**Job:** ${job.jobId}\n\n## Summary\n\n${summary}\n`;
      await filePut(job.outputs.s3Out.bucket, job.outputs.s3Out.key, md);
      emitAnalytics("artifact_saved",{ artifact_id: job.outputs.s3Out.key, job_id: job.jobId, workspace_id: job.workspaceId ?? "ws", type:"document", format:"md" });
      s3Key = job.outputs.s3Out.key;
    }

    let notionPageId: string | undefined;
    if (job.outputs?.notion) {
      const md = `Job ${job.jobId} (${runId}) — summary:\n\n${summary}`;
      notionPageId = await exportToNotion({ title: job.outputs.notion.title, markdown: md, pageId: job.outputs.notion.pageId });
      if (notionPageId) {
        emitAnalytics("notion_export",{ artifact_id: job.outputs?.s3Out?.key ?? "", page_id: notionPageId, success: true });
      }
    }

    await recordRun({ pk: `JOB#${job.jobId}`, sk: `RUN#${runId}`, status: "SUCCEEDED", summary, logs, idemKey: job.idemKey });
    if (job.idemKey) await saveIdem(job.idemKey, runId, job.jobId);
    emitAnalytics("workflow_run_completed",{ job_id: job.jobId, success: true });

    await sqs.send(new DeleteMessageCommand({ QueueUrl: QUEUE_URL, ReceiptHandle: m.ReceiptHandle! }));
  } catch (e: any) {
    await recordRun({ pk: `JOB#${job.jobId}`, sk: `RUN#${runId}`, status: "FAILED", summary: String(e), logs });
    throw e;
  }
}