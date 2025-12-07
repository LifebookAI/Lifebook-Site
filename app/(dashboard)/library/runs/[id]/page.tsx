import Link from "next/link";
import { getLibraryRun } from "@/lib/library/runs";

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
    </main>
  );
}