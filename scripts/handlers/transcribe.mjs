import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

export async function handleTranscribe(payload, ctx) {
  const bucket = process.env.S3_BUCKET || ctx?.secret?.S3_BUCKET || "lifebook.ai";
  const region = ctx?.region || process.env.AWS_REGION || "us-east-1";
  const stage  = ctx?.stage  || process.env.APP_STAGE || (process.env.NODE_ENV === "production" ? "prod" : "dev");
  const kmsKey = ctx?.secret?.S3_KMS_KEY_ID; // optional

  const s3 = new S3Client({ region });
  const jobId = "req-" + crypto.randomUUID();
  const inputKey = payload?.s3Key || "(missing)";
  const base = `catalog/transcripts`;

  // 1) Request record (queued)
  const requestKey = `${base}/requests/${jobId}.json`;
  const reqQueued = {
    jobId, stage, provider: "whisper-v3",
    input: { s3Key: inputKey },
    status: "queued",
    requestedAt: new Date().toISOString()
  };
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: requestKey, Body: JSON.stringify(reqQueued),
    ContentType: "application/json",
    ServerSideEncryption: kmsKey ? "aws:kms" : undefined, SSEKMSKeyId: kmsKey
  }));

  // 2) Stub result artifact (completed)
  const resultKey = `${base}/results/${jobId}.json`;
  const result = {
    jobId, stage, provider: "whisper-v3",
    status: "completed",
    completedAt: new Date().toISOString(),
    text: `[stub] transcript for ${inputKey}`,
    tokens: 0, durationSec: 0
  };
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: resultKey, Body: JSON.stringify(result),
    ContentType: "application/json",
    ServerSideEncryption: kmsKey ? "aws:kms" : undefined, SSEKMSKeyId: kmsKey
  }));

  // 3) Update request record -> link result + status
  const reqDone = { ...reqQueued, status: "completed", resultKey, completedAt: result.completedAt };
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: requestKey, Body: JSON.stringify(reqDone),
    ContentType: "application/json",
    ServerSideEncryption: kmsKey ? "aws:kms" : undefined, SSEKMSKeyId: kmsKey
  }));

  return { bucket, requestKey, resultKey, jobId };
}
