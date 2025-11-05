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
  const body = JSON.stringify({
    jobId,
    provider: "whisper-v3",
    stage,
    input: { s3Key: inputKey },
    requestedAt: new Date().toISOString()
  });

  const key = `catalog/transcripts/requests/${jobId}.json`;
  const putParams = {
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: "application/json",
    ServerSideEncryption: kmsKey ? "aws:kms" : undefined,
    SSEKMSKeyId: kmsKey
  };
  await s3.send(new PutObjectCommand(putParams));
  return { bucket, key, jobId };
}
