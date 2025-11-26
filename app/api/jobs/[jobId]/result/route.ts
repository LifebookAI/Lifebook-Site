import { NextRequest, NextResponse } from 'next/server';
import { getLabSessionForJob } from '@/lib/labs/sessions';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;
  const session = getLabSessionForJob(jobId);

  if (!session) {
    return NextResponse.json(
      { error: `No lab session found for job ${jobId}.` },
      { status: 404 },
    );
  }

  return NextResponse.json({ session }, { status: 200 });
}