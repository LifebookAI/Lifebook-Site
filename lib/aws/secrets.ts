import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

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
    (res.SecretBinary ? Buffer.from(res.SecretBinary as Uint8Array).toString('utf8') : '{}');

  // Parse to unknown, then narrow to plain object and coerce values to string
  const parsed: unknown = JSON.parse(text);
  const out: JsonRecord = {};
  if (parsed && typeof parsed === 'object') {
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      out[k] = String(v);
    }
  }
  _cache.set(name, out);
  return out;
}
