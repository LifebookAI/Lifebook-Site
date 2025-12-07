import Link from "next/link";
import { getLibraryRun } from "@/lib/library/runs";

function formatTimestamp(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default async function LibraryRunDetailPage({
  params,
}: {
  params: { runId: string };
}) {
  const { runId } = params;
  const run = await getLibraryRun(runId);

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Run details
          </h1>
          <p className="text-sm text-muted-foreground">
            This view shows a single workflow run from your Personal Library.
            When configured with a database, it pulls real jobs and artifacts
            for your workspace and falls back to stub data in development.
          </p>
        </div>

        <Link
          href="/library/runs"
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          ← Back to runs
        </Link>
      </div>

      {/* Summary card */}
      <section className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">Run summary</h2>
            <p className="text-xs text-muted-foreground">
              High-level status and timing for this run.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide">
            {run.status}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="space-y-0.5">
            <dt className="text-xs uppercase text-muted-foreground">
              Run ID
            </dt>
            <dd className="font-mono text-xs break-all">{run.id}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs uppercase text-muted-foreground">
              Started at
            </dt>
            <dd className="text-xs">
              {formatTimestamp(run.startedAt)}
            </dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs uppercase text-muted-foreground">
              Completed at
            </dt>
            <dd className="text-xs">
              {formatTimestamp(run.completedAt)}
            </dd>
          </div>
        </dl>
      </section>

      {/* Artifacts list */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Artifacts</h2>
          <p className="text-xs text-muted-foreground">
            Outputs created by this run (transcripts, summaries, exports, etc.).
          </p>
        </div>

        {run.artifacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No artifacts recorded for this run yet.
          </p>
        ) : (
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm divide-y">
            {run.artifacts.map((artifact) => (
              <div
                key={artifact.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="space-y-0.5">
                  <div className="font-medium">{artifact.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {artifact.type} • {formatTimestamp(artifact.createdAt)}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium underline underline-offset-2 hover:text-primary"
                >
                  Open (stub)
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}