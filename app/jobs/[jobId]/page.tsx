import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getJobs, type Job } from '@/app/api/jobs/jobs-store';
import { getLabSessionForJob } from '@/lib/labs/sessions';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{
    jobId: string;
  }>;
};

export default async function JobDetailPage({ params }: PageProps) {
  const { jobId } = await params;
  const jobs: Job[] = getJobs();
  const job = jobs.find((j) => j.id === jobId);

  if (!job) {
    notFound();
    return null;
  }

  const session = getLabSessionForJob(jobId);

  const rawStepTitle = job.metadata?.stepTitle;
  const stepTitle =
    typeof rawStepTitle === 'string' && rawStepTitle.trim().length > 0
      ? rawStepTitle
      : job.templateId ?? '(unknown step)';

  const rawTrackTitle = job.metadata?.trackTitle;
  const trackTitle =
    typeof rawTrackTitle === 'string' && rawTrackTitle.trim().length > 0
      ? rawTrackTitle
      : '(unknown track)';

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link
        href="/jobs"
        className="text-xs font-medium text-blue-500 hover:underline"
      >
        ← Back to jobs
      </Link>

      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Job {jobId}</h1>
        <p className="text-sm text-muted-foreground">
          Study Track job for{' '}
          <span className="font-medium">{trackTitle}</span> ·{' '}
          <span className="font-medium">{stepTitle}</span>
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="mb-2 text-sm font-semibold">Job details</h2>
        <dl className="grid grid-cols-1 gap-y-1 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-medium text-muted-foreground">Job ID</dt>
            <dd>
              <code className="rounded bg-muted px-1.5 py-0.5">{job.id}</code>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Template</dt>
            <dd>{job.templateId ?? '—'}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Journey key</dt>
            <dd>{job.journeyKey ?? '—'}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Status</dt>
            <dd>{job.status ?? 'unknown'}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Created at</dt>
            <dd>{job.createdAt ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="mb-2 text-sm font-semibold">Lab session result</h2>

        {!session ? (
          <p className="text-xs text-muted-foreground">
            No lab session result exists yet for this job. Run the J1 lab job
            via <code>/api/jobs/{jobId}/run</code> to materialize a
            fake/deterministic result.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Completed at{' '}
              <span className="font-medium">{session.completedAt}</span> with
              outcome{' '}
              <span className="font-medium uppercase">{session.outcome}</span>
              {typeof session.scorePercent === 'number' && (
                <>
                  {' '}
                  ·{' '}
                  <span className="font-medium">
                    {session.scorePercent.toFixed(0)}%
                  </span>
                </>
              )}
              .
            </p>

            <p className="text-sm">{session.summary}</p>

            {session.checklist.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  Checklist
                </h3>
                <ul className="space-y-1">
                  {session.checklist.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 text-xs">
                      <span
                        className={`mt-0.5 inline-flex h-3 w-3 flex-none items-center justify-center rounded-full border ${
                          item.done
                            ? 'border-green-500 bg-green-500/20'
                            : 'border-muted-foreground/50 bg-transparent'
                        }`}
                      >
                        {item.done && (
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        )}
                      </span>
                      <span
                        className={
                          item.done
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }
                      >
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}