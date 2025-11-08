import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

type Jsonish = Record<string, unknown>;
type JsonRecord = Record<string, string>;
const _cache = new Map<string, JsonRecord>();

export async function getJsonSecret(
  name: string,
  region = process.env.AWS_REGION ?? 'us-east-1'
): Promise<JsonRecord> {
  const hit = _cache.get(name);
  if (hit) return hit;

  const client = new SecretsManagerClient({ region });
  const res = await client.send(new GetSecretValueCommand({ SecretId: name }));

  const text =
    res.SecretString ??
    (res.SecretBinary ? Buffer.from(res.SecretBinary).toString('utf8') : '{}');

  const parsed: unknown = JSON.parse(text);
  const out: JsonRecord = {};
  if (parsed && typeof parsed === 'object') {
    for (const [k, v] of Object.entries(parsed as Jsonish)) {
      out[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
  }
  _cache.set(name, out);
  return out;
}
