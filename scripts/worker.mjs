import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const region = process.env.AWS_REGION || "us-east-1";
const stage = process.env.APP_STAGE || (process.env.NODE_ENV === "production" ? "prod" : "dev");
const secretName = process.env.APP_SECRETS_NAME || `lifebook/${stage}/app`;

async function getSecretJson(name) {
  const sm = new SecretsManagerClient({ region });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: name }));
  const text = res.SecretString ?? (res.SecretBinary ? Buffer.from(res.SecretBinary).toString("utf8") : "{}");
  return JSON.parse(text);
}

async function main() {
  const sec = await getSecretJson(secretName).catch(() => ({}));
  const queueUrl = process.env.JOBS_QUEUE_URL || sec.JOBS_QUEUE_URL;
  if (!queueUrl) {
    console.error("JOBS_QUEUE_URL not found (env or secret)."); process.exit(2);
  }
  const sqs = new SQSClient({ region });
  console.log(`[worker] listening on ${queueUrl} (region=${region}) — CTRL+C to stop`);

  while (true) {
    const { Messages } = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 5,
      WaitTimeSeconds: 10,
      VisibilityTimeout: 60
    }));
    if (!Messages || Messages.length === 0) continue;

    for (const m of Messages) {
      try {
        const body = JSON.parse(m.Body ?? "{}");
        console.log("[job]", body.name ?? "unknown", body.payload ?? {});
        // TODO: dispatch by body.name
        await sqs.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle }));
      } catch (err) {
        console.error("[error] processing message", err);
      }
    }
  }
}
main().catch(err => { console.error(err); process.exit(1); });
