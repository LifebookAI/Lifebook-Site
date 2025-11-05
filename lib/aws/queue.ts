import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import crypto from 'crypto';
import { getJsonSecret } from '@/lib/aws/secrets';

export type JobPayload = Record<string, unknown>;

function getRegion() { return process.env.AWS_REGION ?? 'us-east-1'; }

async function getQueueUrl(): Promise<string> {
  const stage = process.env.APP_STAGE ?? (process.env.NODE_ENV === 'production' ? 'prod' : 'dev');
  const name  = process.env.APP_SECRETS_NAME ?? `lifebook/${stage}/app`;
  const sec   = await getJsonSecret(name);
  const url   = sec.JOBS_QUEUE_URL ?? process.env.JOBS_QUEUE_URL;
  if (!url) throw new Error('JOBS_QUEUE_URL missing in Secrets or environment');
  return url;
}

export async function enqueueJob(
  name: string,
  payload: JobPayload,
  idempotencyKey?: string
): Promise<void> {
  const url = await getQueueUrl();
  const client = new SQSClient({ region: getRegion() });
  const body = JSON.stringify({ name, payload });
  const dedup = idempotencyKey ?? crypto.createHash('sha256').update(name + '|' + body).digest('hex');
  await client.send(new SendMessageCommand({
    QueueUrl: url,
    MessageBody: body,
    MessageGroupId: name,
    MessageDeduplicationId: dedup
  }));
}
