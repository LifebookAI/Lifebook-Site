import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enqueueJob } from '@/lib/aws/queue';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  name: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().optional()
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const body = BodySchema.parse(json);
  await enqueueJob(body.name, body.payload, body.idempotencyKey);
  return NextResponse.json({ ok: true, enqueued: true }, { status: 202 });
}
