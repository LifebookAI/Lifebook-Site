import { NextResponse } from 'next/server';
import { listRuns } from '@/server/orchestrator/runs';

export async function GET() {
  try {
    const runs = await listRuns();
    return NextResponse.json({ runs });
  } catch (error) {
    console.error('GET /api/library/runs failed', error);
    return NextResponse.json(
      { error: 'Failed to load runs' },
      { status: 500 },
    );
  }
}
