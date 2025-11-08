import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { transcribeOpenAI } from "../stt/openai.mjs";

export async function handleTranscribe(payload, ctx) {
  const bucket = process.env.S3_BUCKET || ctx?.secret?.S3_BUCKET || "lifebook.ai";
  const region = ctx?.region || process.env.AWS_REGION || "us-east-1";
  const stage  = ctx?.stage  || process.env.APP_STAGE || (process.env.NODE_ENV === "production" ? "prod" : "dev");
  const kmsKey = ctx?.secret?.S3_KMS_KEY_ID; // optional

  const s3 = new S3Client({ region });
  const jobId = "req-" + crypto.randomUUID();
  const inputKey = payload?.s3Key || "(missing)";
  const base = `catalog/transcripts`;

  // 1) Request (queued)
  const requestKey = `${base}/requests/${jobId}.json`;
  const reqQueued = { jobId, stage, provider: "openai", input: { s3Key: inputKey }, status: "queued", requestedAt: new Date().toISOString() };
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: requestKey, Body: JSON.stringify(reqQueued),
    ContentType: "application/json",
    ServerSideEncryption: kmsKey ? "aws:kms" : undefined, SSEKMSKeyId: kmsKey
  }));

  // 2) Decide path: real OpenAI if key present, else dry-run
  const apiKey = process.env.OPENAI_API_KEY || ctx?.secret?.OPENAI_API_KEY;
  const model  = process.env.STT_MODEL || ctx?.secret?.STT_MODEL || "whisper-1";
  const baseUrl = process.env.OPENAI_API_BASE || ctx?.secret?.OPENAI_API_BASE || "https://api.openai.com";

  let out;
  try {
    if (apiKey) {
      out = await transcribeOpenAI({ bucket, key: inputKey, region }, { apiKey, model, baseUrl });
    } else {
      out = { text: `[openai:dry-run] transcript for ${inputKey}`, tokens: 0, durationSec: 0, provider: "openai(dry-run)" };
    }
  } catch (err) {
    out = { text: `[error] ${String(err?.message || err)}`, tokens: 0, durationSec: 0, provider: "openai(error)" };
  }

  // 3) Write result
  const resultKey = `${base}/results/${jobId}.json`;
  const result = {
    jobId, stage, provider: out.provider, status: "completed",
    completedAt: new Date().toISOString(), text: out.text, tokens: out.tokens, durationSec: out.durationSec
  };
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: resultKey, Body: JSON.stringify(result),
    ContentType: "application/json",
    ServerSideEncryption: kmsKey ? "aws:kms" : undefined, SSEKMSKeyId: kmsKey
  }));

  // 4) Update request with completion + link
  const reqDone = { ...reqQueued, status: "completed", resultKey, completedAt: result.completedAt };
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: requestKey, Body: JSON.stringify(reqDone),
    ContentType: "application/json",
    ServerSideEncryption: kmsKey ? "aws:kms" : undefined, SSEKMSKeyId: kmsKey
  }));

  return { bucket, requestKey, resultKey, jobId };
}
