"use server";

import crypto from "node:crypto";
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type {
  CreateJobRequest,
  JobRecord,
  JobStatus,
  JobSummary,
  OrchestratorJobMessage,
} from "./types";

const region = process.env.AWS_REGION ?? "us-east-1";
const jobsTable = process.env.JOBS_TABLE_NAME;
const queueUrl = process.env.ORCHESTRATOR_QUEUE_URL;

if (!jobsTable) {
  throw new Error("JOBS_TABLE_NAME env var is required");
}

if (!queueUrl) {
  throw new Error("ORCHESTRATOR_QUEUE_URL env var is required");
}

const dynamo = new DynamoDBClient({ region });
const sqs = new SQSClient({ region });

function toJobSummary(record: JobRecord): JobSummary {
  const {
    jobId,
    workflowSlug,
    status,
    createdAt,
    updatedAt,
    lastRunAt,
    clientRequestId,
  } = record;

  return {
    id: jobId,
    jobId,
    workflowSlug,
    status,
    createdAt,
    updatedAt,
    lastRunAt,
    clientRequestId,
  };
}

function makeJobId(workflowSlug: string, clientRequestId?: string): string {
  if (clientRequestId) {
    const hash = crypto.createHash("sha256");
    hash.update(`${workflowSlug}:${clientRequestId}`);
    return hash.digest("hex").slice(0, 32);
  }
  return crypto.randomUUID();
}

/**
 * Create a job row in Dynamo and enqueue it on the orchestrator queue.
 * If a job with the same (workflowSlug, clientRequestId) already exists,
 * the existing job is returned and *no* extra enqueue occurs.
 */
export async function createJob(
  req: CreateJobRequest
): Promise<JobSummary> {
  const workflowSlug = req.workflowSlug ?? req.workflowKey;
  if (!workflowSlug) {
    throw new Error("Missing workflowSlug");
  }

  const clientRequestId = req.clientRequestId;
  const jobId = makeJobId(workflowSlug, clientRequestId);
  const now = new Date().toISOString();
  const status: JobStatus = "queued";

  const record: JobRecord = {
    // pk/sk match the table key; we mirror jobId in pk so we can
    // fetch rows by jobId regardless of table key naming.
    pk: jobId,
    sk: "JOB",

    jobId,
    workflowSlug,
    status,
    createdAt: now,
    updatedAt: now,
    clientRequestId,
  };

  if (req.input !== undefined) {
    record.inputJson = JSON.stringify(req.input);
  }

  try {
    await dynamo.send(
      new PutItemCommand({
        TableName: jobsTable,
        Item: marshall(record),
        // Idempotency: only create if pk (jobId) does not already exist
        ConditionExpression: "attribute_not_exists(pk)",
      })
    );

    const message: OrchestratorJobMessage = {
      jobId,
      workflowSlug,
    };

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(message),
      })
    );

    return toJobSummary(record);
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      // Idempotency case: job already exists.
      const existing = await getJobById(jobId);
      if (!existing) {
        // Extremely unlikely race: condition failed but no record; surface error.
        throw error;
      }
      return existing;
    }

    throw error;
  }
}

export async function getJobById(
  jobId: string
): Promise<JobSummary | null> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: jobsTable,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": { S: jobId },
      },
      Limit: 1,
    })
  );

  const items = result.Items ?? [];
  if (items.length === 0) {
    return null;
  }

  const record = unmarshall(items[0]) as JobRecord;
  if (!record.jobId) {
    return null;
  }
  return toJobSummary(record);
}

export async function listRecentJobs(
  limit = 50
): Promise<JobSummary[]> {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: jobsTable,
      Limit: limit,
    })
  );

  const rawItems =
    result.Items?.map((raw) => unmarshall(raw) as JobRecord) ?? [];

  // Filter out legacy rows that don’t have a jobId/createdAt so the
  // UI keys stay stable and we only show real orchestrator jobs.
  const items = rawItems.filter(
    (r) =>
      typeof r.jobId === "string" &&
      r.jobId.length > 0 &&
      typeof r.createdAt === "string" &&
      r.createdAt.length > 0
  );

  items.sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  );

  return items.slice(0, limit).map(toJobSummary);
}
