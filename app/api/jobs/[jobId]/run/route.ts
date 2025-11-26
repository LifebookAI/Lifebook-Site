import { NextRequest, NextResponse } from 'next/server';
import { getJobs, type Job } from '../../jobs-store';
import {
  createOrUpdateLabSessionFromJob,
  type JobForSession,
} from '@/lib/labs/sessions';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { jobId } = await params;
  const jobs: Job[] = getJobs();
  const job = jobs.find((j) => j.id === jobId);

  if (!job) {
    return NextResponse.json(
      { error: `Job ${jobId} not found.` },
      { status: 404 },
    );
  }

  const jobForSession: JobForSession = {
    id: job.id,
    templateId: job.templateId ?? 'unknown-template',
    journeyKey: job.journeyKey,
    metadata: job.metadata,
  };

  const session = createOrUpdateLabSessionFromJob(jobForSession);

  return NextResponse.json({ job, session }, { status: 200 });
}