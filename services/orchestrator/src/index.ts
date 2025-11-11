import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({});
const BUCKET = process.env.S3_BUCKET || "lifebook.ai";
const KMS = process.env.LFLBK_KMS_KEY;

type Incoming = { jobId?: string; outputs?: { s3Out?: { bucket?: string; key?: string } } };

export const handler = async (event: any) => {
  const records = Array.isArray(event?.Records) ? event.Records : [ { body: JSON.stringify(event) } ];
  for (const r of records) {
    const body: Incoming = JSON.parse(r.body ?? "{}");
    const jobId = body.jobId || `manual-${Math.random().toString(36).slice(2,10)}`;
    const outBucket = body.outputs?.s3Out?.bucket || BUCKET;
    const outKey = body.outputs?.s3Out?.key || `workflows/manual/${jobId}/result.md`;
    const content = `# Lifebook Orchestrator
Job: ${jobId}
When: ${new Date().toISOString()}
Result: OK (hello from minimal handler)
`;
    const cmd = new PutObjectCommand({
      Bucket: outBucket, Key: outKey, Body: content,
      ContentType: "text/markdown; charset=utf-8",
      ServerSideEncryption: "aws:kms", SSEKMSKeyId: KMS,
    });
    await s3.send(cmd);
    console.log(`WROTE s3://${outBucket}/${outKey}`);
  }
  return { ok: true };
};