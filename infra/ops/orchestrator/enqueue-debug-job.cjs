"use strict";

const { randomUUID } = require("node:crypto");
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const fs = require("node:fs");
const path = require("node:path");

function getEnvOrDotEnv(keys) {
  // First try process.env
  for (const key of keys) {
    const raw = process.env[key];
    if (raw && String(raw).trim()) {
      return String(raw).trim();
    }
  }

  // Fallback: look in .env.local at repo root (process.cwd())
  const dotEnvPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(dotEnvPath)) {
    const lines = fs.readFileSync(dotEnvPath, "utf8").split(/\r?\n/);
    for (const key of keys) {
      const line = lines.find((l) => l.startsWith(key + "="));
      if (line) {
        const value = line.split("=", 2)[1];
        if (value && value.trim()) {
          return value.trim();
        }
      }
    }
  }

  return null;
}

async function main() {
  const region = process.env.AWS_REGION || "us-east-1";

  const jobsTable = getEnvOrDotEnv([
    "LFLBK_ORCH_JOBS_TABLE",
    "JOBS_TABLE_NAME",
  ]);
  if (!jobsTable) {
    console.error(
      "[enqueue-debug-job] Missing jobs table env (LFLBK_ORCH_JOBS_TABLE/JOBS_TABLE_NAME)."
    );
    process.exit(1);
  }

  const queueUrl = getEnvOrDotEnv([
    "LFLBK_ORCH_QUEUE_URL",
    "ORCH_QUEUE_URL",
  ]);
  if (!queueUrl) {
    console.error(
      "[enqueue-debug-job] Missing orchestrator queue env (LFLBK_ORCH_QUEUE_URL/ORCH_QUEUE_URL)."
    );
    process.exit(1);
  }

  const jobId = randomUUID();
  const workflowSlug = "debug_hello_world";
  const now = new Date().toISOString();

  const dynamo = new DynamoDBClient({ region });
  const sqs = new SQSClient({ region });

  console.log(
    "[enqueue-debug-job] Using jobsTable=%s, queueUrl=%s",
    jobsTable,
    queueUrl
  );
  console.log(
    "[enqueue-debug-job] Creating job %s for workflow %s ...",
    jobId,
    workflowSlug
  );

  await dynamo.send(
    new PutItemCommand({
      TableName: jobsTable,
      Item: {
        pk: { S: jobId },
        sk: { S: "job" },
        jobId: { S: jobId },
        workflowSlug: { S: workflowSlug },
        status: { S: "queued" },
        createdAt: { S: now },
        updatedAt: { S: now },
      },
    })
  );

  const message = {
    jobId,
    workflowSlug,
  };

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
    })
  );

  console.log("[enqueue-debug-job] Enqueued orchestrator message:", message);
  console.log("[enqueue-debug-job] Done.");
}

main().catch((err) => {
  console.error("[enqueue-debug-job] Failed:", err);
  process.exit(1);
});