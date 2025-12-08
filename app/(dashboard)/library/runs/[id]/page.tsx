import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRunDetail, type RunDetail } from '@/server/orchestrator/runs';

interface PageProps {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

export default async function LibraryRunDetailPage({ params }: PageProps) {
  let run: RunDetail | null;

  try {
    run = await getRunDetail(params.id);
  } catch (error) {
    console.error('LibraryRunDetailPage getRunDetail failed', error);
    throw error; // handled by app/library/runs/[id]/error.tsx
  }

  if (!run) {
    return notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">
            <Link href="/library/runs" className="hover:underline">
              ← Back to runs
            </Link>
          </p>
          <h1 className="text-xl font-semibold">{run.label}</h1>
          <p className="text-xs text-muted-foreground">
            Workflow:{' '}
            <span className="font-mono">{run.workflowSlug}</span>
          </p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs capitalize">
          {run.status}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1 text-sm">
          <div className="font-medium">Timestamps</div>
          <div>
            <span className="text-muted-foreground">Created: </span>
            {new Date(run.createdAt).toLocaleString()}
          </div>
          <div>
            <span className="text-muted-foreground">Updated: </span>
            {new Date(run.updatedAt).toLocaleString()}
          </div>
        </div>

        <div className="space-y-1 text-sm md:col-span-2">
          <div className="font-medium">Input summary</div>
          <p className="whitespace-pre-wrap text-muted-foreground">
            {run.inputSummary ?? '—'}
          </p>
        </div>

        <div className="space-y-1 text-sm md:col-span-2">
          <div className="font-medium">Output summary</div>
          <p className="whitespace-pre-wrap text-muted-foreground">
            {run.outputSummary ?? '—'}
          </p>
        </div>

        {run.errorMessage && (
          <div className="space-y-1 text-sm md:col-span-3">
            <div className="font-medium text-destructive">Error</div>
            <pre className="overflow-x-auto rounded-lg border bg-destructive/5 p-3 text-xs">
              {run.errorMessage}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

