import { NextResponse } from 'next/server';
import { getRunDetail } from '@/server/orchestrator/runs';

interface Params {
  params: { id: string };
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const run = await getRunDetail(params.id);

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (error) {
    console.error('GET /api/library/runs/' + params.id + ' failed', error);
    return NextResponse.json(
      { error: 'Failed to load run detail' },
      { status: 500 },
    );
  }
}
