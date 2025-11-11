import { S3Client, HeadObjectCommand, PutObjectCommand, PutObjectTaggingCommand } from "@aws-sdk/client-s3";
import type { S3Event, Context } from "aws-lambda";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.LIFEBOOK_BUCKET || "lifebook.ai";
const KMS_ARN = process.env.LIFEBOOK_KMS_KEY_ARN || "arn:aws:kms:us-east-1:354630286254:key/583a1a4c-efbc-486d-8025-66577c04116a";

const s3 = new S3Client({ region: REGION });

function b64ToHex(b64?: string): string|undefined {
  if(!b64) return;
  return Buffer.from(b64, "base64").toString("hex");
}

export const handler = async (event: S3Event, ctx: Context) => {
  const reqId = ctx.awsRequestId;
  for (const rec of event.Records) {
    const key = decodeURIComponent(rec.s3.object.key.replace(/\+/g, " "));
    if(!key.startsWith("sources/")) continue;

    // sources/{workspaceId}/{guid}/{fileName}
    const parts = key.split("/");
    const workspaceId = parts[1] || "unknown";
    const guid        = parts[2] || "unknown";
    const fileName    = parts.slice(3).join("/") || "";

    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      const size = head.ContentLength || 0;
      const contentType = head.ContentType || "application/octet-stream";
      const checksumB64 = head.ChecksumSHA256;
      const checksumHex = b64ToHex(checksumB64) || "";

      // Tag the source (idempotent)
      await s3.send(new PutObjectTaggingCommand({
        Bucket: BUCKET, Key: key,
        Tagging: { TagSet: [
          { Key: "workspaceId", Value: workspaceId },
          { Key: "guid",        Value: guid },
          { Key: "sha256",      Value: checksumHex },
          { Key: "ct",          Value: contentType }
        ] }
      }));

      const meta = {
        workspaceId, guid, fileName, bucket: BUCKET, key,
        size, contentType, checksumSHA256: checksumHex,
        receivedAt: new Date().toISOString()
      };
      const transcript = { guid, status: "pending", text: "" };

      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: `catalog/meta/${guid}.json`,
        Body: Buffer.from(JSON.stringify(meta, null, 2)),
        ContentType: "application/json",
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: KMS_ARN
      }));
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: `catalog/transcripts/${guid}.json`,
        Body: Buffer.from(JSON.stringify(transcript, null, 2)),
        ContentType: "application/json",
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: KMS_ARN
      }));

      // EMF metric via structured log
      console.log(JSON.stringify({
        _aws: {
          Timestamp: Date.now(),
          CloudWatchMetrics: [{
            Namespace: "Lifebook/Ingest",
            Dimensions: [["Function","WorkspaceId"]],
            Metrics: [{ Name: "IngestAccepted", Unit: "Count" }]
          }]
        },
        Function: "lifebook-ingest",
        WorkspaceId: workspaceId,
        IngestAccepted: 1
      }));

      console.log(JSON.stringify({ msg:"ingest.ok", reqId, workspaceId, guid, key }));
    } catch (err:any) {
      console.error(JSON.stringify({ msg:"ingest.err", reqId, key, err: (err?.message||"unknown") }));
      throw err;
    }
  }
};