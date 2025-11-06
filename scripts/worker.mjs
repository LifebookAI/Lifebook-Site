import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, ChangeMessageVisibilityCommand } from "@aws-sdk/client-sqs";
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { handleTranscribe } from "./handlers/transcribe.mjs";

const region = process.env.AWS_REGION || "us-east-1";
const stage = process.env.APP_STAGE || (process.env.NODE_ENV === "production" ? "prod" : "dev");
const cw = new CloudWatchClient({ region });
async function emitJobMetrics(kind, stage, startedAtMs){
  try {
    const now = Date.now();
    const latency = Math.max(0, now - (startedAtMs||now));
    await cw.send(new PutMetricDataCommand({
      Namespace: 'Lifebook/Jobs',
      MetricData: [
        { MetricName: 'TranscribeCompleted', Dimensions:[{Name:'Stage',Value:stage}], Timestamp: new Date(), Unit: 'Count', Value: 1 },
        { MetricName: 'TranscribeLatencyMs', Dimensions:[{Name:'Stage',Value:stage}], Timestamp: new Date(), Unit: 'Milliseconds', Value: latency }
      ]
    }));
  } catch(e){ console.warn('[metrics] put failed', e?.message||e); }
}
const secretName = process.env.APP_SECRETS_NAME || `lifebook/${stage}/app`;

async function getSecretJson(name) {
  const sm = new SecretsManagerClient({ region });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: name }));
  const text = res.SecretString ?? (res.SecretBinary ? Buffer.from(res.SecretBinary).toString("utf8") : "{}");
  return JSON.parse(text);
}
function toBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").toLowerCase().trim();
  return s === "1" || s === "true" || s === "yes";
}

async function main() {
  const sec = await getSecretJson(secretName).catch(() => ({}));
  const queueUrl = process.env.JOBS_QUEUE_URL || sec.JOBS_QUEUE_URL;
  if (!queueUrl) { console.error("JOBS_QUEUE_URL not found (env or secret)."); process.exit(2); }

  const featureTranscribe = toBool(process.env.FEATURE_TRANSCRIBE ?? sec.FEATURE_TRANSCRIBE);
  const sqs = new SQSClient({ region });
  console.log(`[worker] listening on ${queueUrl} (region=${region}) — feature.transcribe=${featureTranscribe} — CTRL+C to stop`);

  while (true) {
    const { Messages } = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl, MaxNumberOfMessages: 5, WaitTimeSeconds: 10, VisibilityTimeout: 60
    }));
    if (!Messages || Messages.length === 0) continue;

    for (const m of Messages) {
                  const startedAtMs = Date.now();
try {
        const body = JSON.parse(m.Body ?? "{}");
        const name = body.name ?? "unknown";
        const payload = body.payload ?? {};

        switch (name) {
          case "transcribe": {
            if (!featureTranscribe) {
              console.log("[skip] transcribe disabled by FEATURE_TRANSCRIBE");
              await sqs.send(new ChangeMessageVisibilityCommand({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle, VisibilityTimeout: 10 }));
              break;
            }
            const res = await handleTranscribe(payload, { region, stage, secret: sec });
            console.log(`[transcribe] stub wrote request record s3://${res.bucket}/${res.key} (jobId=${res.jobId})`);
            await sqs.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle }));
            break;
          }
          default: {
            console.log("[job]", name, payload);
            await sqs.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle }));
          }
        }
      } catch (err) {
        console.error("[error] processing message", err);
      }
    }
  }
}
main().catch(err => { console.error(err); process.exit(1); });
