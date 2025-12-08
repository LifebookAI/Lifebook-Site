import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

export interface RunLogEntry {
  jobId: string;
  step: string;
  message: string;
  statusBefore?: string | null;
  statusAfter?: string | null;
  createdAt: string;
}

export interface RunDetail {
  jobId: string;
  workflowSlug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string | null;
  runLogs: RunLogEntry[];
}

const region = process.env.AWS_REGION ?? "us-east-1";

const jobsTable =
  process.env.ORCH_JOBS_TABLE ?? "lifebook-orchestrator-jobs";

const runLogsTable =
  process.env.ORCH_RUN_LOGS_TABLE ?? "lifebook-orchestrator-run-logs";

const ddbClient = new DynamoDBClient({ region });
const ddb = DynamoDBDocumentClient.from(ddbClient);

export async function getRunDetail(jobId: string): Promise<RunDetail | null> {
  if (!jobId.trim()) {
    throw new Error("jobId is required");
  }

  // 1) Fetch the job
  const jobResp = await ddb.send(
    new GetCommand({
      TableName: jobsTable,
      Key: {
        pk: jobId,
        sk: "job",
      },
    })
  );

  if (!jobResp.Item) {
    return null;
  }

  const jobItem = jobResp.Item as any;

  const workflowSlug: string = jobItem.workflowSlug;
  const status: string = jobItem.status;
  const createdAt: string = jobItem.createdAt;
  const updatedAt: string = jobItem.updatedAt;
  const lastError: string | null = jobItem.lastError ?? null;

  // 2) Fetch run logs (partitioned by jobId)
  const logsResp = await ddb.send(
    new QueryCommand({
      TableName: runLogsTable,
      KeyConditionExpression: "jobId = :jobId",
      ExpressionAttributeValues: {
        ":jobId": jobId,
      },
    })
  );

  const items = (logsResp.Items ?? []) as any[];

  // Sort by createdAt asc, mirroring the PowerShell timeline
  items.sort((a, b) => {
    const aTs = a.createdAt ?? "";
    const bTs = b.createdAt ?? "";
    return String(aTs).localeCompare(String(bTs));
  });

  const runLogs: RunLogEntry[] = items.map((item) => ({
    jobId: item.jobId,
    step: item.step,
    message: item.message,
    statusBefore: item.statusBefore ?? null,
    statusAfter: item.statusAfter ?? null,
    createdAt: item.createdAt,
  }));

  return {
    jobId,
    workflowSlug,
    status,
    createdAt,
    updatedAt,
    lastError,
    runLogs,
  };
}
