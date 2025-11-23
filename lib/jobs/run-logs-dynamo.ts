"use server";

import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { RunLog, RunLogRecord } from "./types";

const region = process.env.AWS_REGION ?? "us-east-1";
const runLogsTable = process.env.RUN_LOGS_TABLE_NAME;

if (!runLogsTable) {
  throw new Error("RUN_LOGS_TABLE_NAME env var is required");
}

const dynamo = new DynamoDBClient({ region });

/**
 * Input for appendRunLog: we always guarantee createdAt internally.
 */
type AppendRunLogInput = Omit<RunLogRecord, "createdAt"> & {
  createdAt?: string;
};

/**
 * Append a single run log entry for a job.
 *
 * Table schema (lifebook-orchestrator-run-logs):
 *   - PK: jobId (S)
 *   - SK: createdAt (S, ISO8601)
 */
export async function appendRunLog(input: AppendRunLogInput): Promise<void> {
  const createdAt = input.createdAt ?? new Date().toISOString();

  const record: RunLogRecord = {
    ...input,
    createdAt,
  };

  await dynamo.send(
    new PutItemCommand({
      TableName: runLogsTable,
      Item: marshall(record),
    })
  );
}

/**
 * List recent run logs for a given job, newest first.
 */
export async function listRunLogs(
  jobId: string,
  limit = 50
): Promise<RunLog[]> {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: runLogsTable,
      KeyConditionExpression: "jobId = :jobId",
      ExpressionAttributeValues: {
        ":jobId": { S: jobId },
      },
      Limit: limit,
      ScanIndexForward: false, // newest first
    })
  );

  const items =
    res.Items?.map((raw) => unmarshall(raw) as RunLogRecord) ?? [];

  // Strip internal-only fields (jobId/detailsJson) before returning.
  return items.map((item) => {
    const { jobId: _jobId, detailsJson: _details, ...rest } = item;
    return rest;
  });
}
