import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
const _cache = new Map<string, any>();
export async function getJsonSecret(name: string, region = process.env.AWS_REGION ?? 'us-east-1') {
  if (_cache.has(name)) return _cache.get(name);
  const client = new SecretsManagerClient({ region });
  const res = await client.send(new GetSecretValueCommand({ SecretId: name }));
  const text = res.SecretString ?? (res.SecretBinary ? Buffer.from(res.SecretBinary as any).toString('utf8') : '{}');
  const json = JSON.parse(text);
  _cache.set(name, json);
  return json;
}
