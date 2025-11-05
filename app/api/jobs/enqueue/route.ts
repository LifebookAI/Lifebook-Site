import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enqueueJob } from '@/lib/aws/queue';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  name: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().optional()
});
type Body = z.infer<typeof BodySchema>;

export async function POST(req: Request) {
  const jsonUnknown: unknown = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(jsonUnknown);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }
  const body: Body = parsed.data;
  await enqueueJob(body.name, body.payload, body.idempotencyKey);
  return NextResponse.json({ ok: true, enqueued: true }, { status: 202 });
}
