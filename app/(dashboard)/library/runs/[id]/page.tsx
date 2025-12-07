import Link from "next/link";
import { getLibraryRun } from "@/lib/library/runs";
import type { RunLog } from "@/lib/jobs/types";
import { listRunLogs } from "@/lib/jobs/run-logs-dynamo";

type LibraryRunPageProps = {
  params: {
    id: string;
  };
};

function formatTimestamp(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default async function LibraryRunPage({ params }: LibraryRunPageProps) {
  const runId = params.id;
  const run = await getLibraryRun(runId);

  const lastUpdated = run.completedAt ?? run.startedAt;

  let logs: RunLog[] = [];
  try {
    // For now we assume Library run id == orchestrator job id.
    logs = await listRunLogs(run.id);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[library] Failed to load run logs for Library run detail page",
        err,
      );
    }
  }

  const hasLogs = logs.length > 0;
  const sortedLogs = hasLogs
    ? [...logs].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    : [];

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {run.label}
            </h1>
            <p className="text-sm text-muted-foreground">
              Library workflow run{" "}
              <span className="font-mono text-xs">{run.id}</span>
            </p>
          </div>

          <Link
            href="/library/runs"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            ← Back to runs
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 uppercase tracking-wide">
            {run.status}
          </span>
          <span className="text-muted-foreground">
            Started: {formatTimestamp(run.startedAt)}
          </span>
          <span className="text-muted-foreground">
            Completed: {formatTimestamp(run.completedAt)}
          </span>
          <span className="text-muted-foreground">
            Last updated: {formatTimestamp(lastUpdated)}
          </span>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Artifacts</h2>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
          {run.artifacts.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              This run has no saved artifacts yet. When workflows emit outputs
              (transcripts, summaries, exports), they&apos;ll show up here.
            </p>
          ) : (
            <ul className="divide-y">
              {run.artifacts.map((artifact) => (
                <li
                  key={artifact.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <div className="truncate font-medium">
                      {artifact.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {artifact.type} • {formatTimestamp(artifact.createdAt)}
                    </div>
                  </div>
                  <span className="rounded-full border px-2 py-0.5 text-xs uppercase tracking-wide">
                    {artifact.type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Run history</h2>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
          {!hasLogs ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No run logs recorded yet for this job. Once the orchestrator is
              wired to a real workflow engine, step-by-step logs will show up
              here.
            </p>
          ) : (
            <ul className="divide-y">
              {sortedLogs.map((log, index) => (
                <li
                  key={`${log.createdAt}-${index}`}
                  className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-muted-foreground">
                      {formatTimestamp(log.createdAt)}
                    </div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {log.step ?? "event"}
                    </div>
                    {log.message ? (
                      <div className="text-sm">{log.message}</div>
                    ) : null}
                  </div>
                  {(log.statusBefore || log.statusAfter) && (
                    <div className="flex flex-col items-end text-right">
                      {log.statusBefore ? (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {log.statusBefore}
                        </span>
                      ) : null}
                      {log.statusAfter ? (
                        <span className="mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          {log.statusAfter}
                        </span>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}