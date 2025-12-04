import Link from "next/link";
import { getRecentLibraryRuns } from "@/lib/orchestrator/library-runs";

type RunDetailPageProps = {
  params: {
    runId: string;
  };
};

export default function LibraryRunDetailPage({ params }: RunDetailPageProps) {
  const decodedRunId = decodeURIComponent(params.runId);
  const runs = getRecentLibraryRuns(100);
  const run = runs.find((r) => r.runId === decodedRunId);

  if (!run) {
    return (
      <main className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Run not found
          </h1>
          <p className="max-w-xl text-sm text-slate-500">
            We could not find a Library run with ID{" "}
            <span className="font-mono text-xs">{decodedRunId}</span>.
          </p>
        </header>
        <p className="text-sm">
          <Link
            href="/library/activity"
            className="text-sky-600 hover:underline"
          >
            Back to Library activity
          </Link>
        </p>
      </main>
    );
  }

  const created = new Date(run.createdAt as any);
  const createdDisplay = Number.isNaN(created.getTime())
    ? String(run.createdAt)
    : created.toLocaleString();

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Run details
        </h1>
        <p className="max-w-xl text-sm text-slate-500">
          Inspect the payload for a single Library run. In the full orchestrator,
          this page will show live status updates and logs.
        </p>
      </header>

      <section className="space-y-4">
        <div className="max-w-xl rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Run ID
              </dt>
              <dd className="font-mono text-[11px] text-slate-800">
                {run.runId}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Workflow
              </dt>
              <dd className="text-sm text-slate-900">
                <Link
                  href={`/library/${run.slug}`}
                  className="font-medium text-sky-700 hover:underline"
                >
                  {run.slug}
                </Link>
                <p className="text-[11px] text-slate-500">
                  {run.libraryItemId}
                </p>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </dt>
              <dd className="text-sm text-slate-800">{run.status}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Created at
              </dt>
              <dd className="text-sm text-slate-800">{createdDisplay}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="space-y-2 text-xs text-slate-500">
        <p>
          Note: This run is stored in an in-memory buffer for local development
          only. It will disappear on server restart or deploy.
        </p>
        <p>
          <Link
            href="/library/activity"
            className="font-medium text-sky-600 hover:underline"
          >
            Back to Library activity
          </Link>
        </p>
      </section>
    </main>
  );
}
