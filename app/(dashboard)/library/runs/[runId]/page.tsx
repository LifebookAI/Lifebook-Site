import { notFound } from "next/navigation";
import { pgQuery } from "../../../../../lib/j1-db";

type LibraryRunPageProps = {
  params: { runId: string };
};

type JobRow = {
  run_id: string;
  library_item_id: string | null;
  status: string;
  kind: string | null;
  created_at: string;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "–";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default async function LibraryRunPage({ params }: LibraryRunPageProps) {
  const { runId } = params;

  const result = await pgQuery<JobRow>(
    `
      SELECT
        run_id,
        library_item_id,
        status,
        kind,
        created_at,
        queued_at,
        started_at,
        completed_at,
        error_message
      FROM jobs
      WHERE run_id = $1
      LIMIT 1;
    `,
    [runId],
  );

  const row = result.rows[0];

  if (!row) {
    notFound();
  }

  const statusLabel = row.status ?? "unknown";

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Library run
        </p>
        <h1 className="text-2xl font-semibold break-all">
          {row.run_id}
        </h1>
        <p className="text-sm text-muted-foreground">
          This page shows the current status for a run created from a Library workflow template.
        </p>
      </header>

      <section className="border rounded-lg p-4 space-y-3">
        <div className="flex justify-between gap-4">
          <span className="font-medium">Status</span>
          <span className="font-mono px-2 py-0.5 rounded-full border text-xs">
            {statusLabel}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <span className="font-medium">Kind</span>
          <span className="font-mono">{row.kind ?? "–"}</span>
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <span className="font-medium">Library item</span>
          <span className="font-mono">
            {row.library_item_id ?? "–"}
          </span>
        </div>
      </section>

      <section className="border rounded-lg p-4 space-y-2 text-sm">
        <h2 className="font-semibold text-sm">Timeline</h2>
        <dl className="space-y-1">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-mono">{formatDate(row.created_at)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Queued</dt>
            <dd className="font-mono">{formatDate(row.queued_at)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Started</dt>
            <dd className="font-mono">{formatDate(row.started_at)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Completed</dt>
            <dd className="font-mono">{formatDate(row.completed_at)}</dd>
          </div>
        </dl>
      </section>

      {row.error_message && (
        <section className="border rounded-lg p-4 space-y-2 text-sm">
          <h2 className="font-semibold text-red-600">Error</h2>
          <pre className="whitespace-pre-wrap break-words text-xs bg-red-950/40 border border-red-900 rounded-md p-2">
            {row.error_message}
          </pre>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        For the MVP, Library runs will initially remain in the <code>queued</code> state
        until the orchestrator worker begins updating job status. You can link to this page
        from the Library UI using <code>/library/runs/&lt;runId&gt;</code>.
      </p>
    </main>
  );
}
