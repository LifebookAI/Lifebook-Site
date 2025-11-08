import { z } from 'zod';
import { getJsonSecret } from '@/lib/aws/secrets';

const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(['development','test','production']),
  AWS_REGION: z.string().default('us-east-1'),
  APP_STAGE: z.enum(['dev','prod']).default(process.env.NODE_ENV === 'production' ? 'prod' : 'dev'),
  SESSION_COOKIE_SECRET: z.string().min(32, "SESSION_COOKIE_SECRET must be at least 32 chars")
});
const ClientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default('Lifebook')
});
export type ServerEnv = z.infer<typeof ServerEnvSchema>;
export type ClientEnv = z.infer<typeof ClientEnvSchema>;
let _serverEnv: ServerEnv | null = null;

export async function getServerEnv(): Promise<ServerEnv> {
  if (_serverEnv) return _serverEnv;

  if (process.env.NODE_ENV !== 'production') {
    try { await import('dotenv').then(m => m.config({ path: '.env.local' })); } catch {}
  }

  const stage = process.env.APP_STAGE ?? (process.env.NODE_ENV === 'production' ? 'prod' : 'dev');
  const name  = process.env.APP_SECRETS_NAME ?? `lifebook/${stage}/app`;

  let fromSecrets: Record<string, string> = {};
  if (process.env.NODE_ENV === 'production' || process.env.USE_AWS_SECRETS === '1') {
    try { fromSecrets = await getJsonSecret(name); } catch { /* fall back to process.env */ }
  }

  const merged: Record<string, string | undefined> = {
    ...(process.env as Record<string, string | undefined>),
    ...fromSecrets
  };

  const parsed = ServerEnvSchema.parse({
    NODE_ENV: merged.NODE_ENV,
    AWS_REGION: merged.AWS_REGION,
    APP_STAGE: merged.APP_STAGE,
    SESSION_COOKIE_SECRET: merged.SESSION_COOKIE_SECRET
  });

  _serverEnv = parsed;
  return parsed;
}

export function getClientEnv(): ClientEnv {
  return ClientEnvSchema.parse({ NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME });
}
