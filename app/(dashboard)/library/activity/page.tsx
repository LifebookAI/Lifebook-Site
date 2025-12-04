import Link from "next/link";
import { getRecentLibraryRuns } from "@/lib/orchestrator/library-runs";

export default function LibraryActivityPage() {
  const runs = getRecentLibraryRuns(20);
  const hasRuns = runs.length > 0;

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Library activity
        </h1>
        <p className="max-w-xl text-sm text-slate-500">
          Recent runs started from Library workflows in this local session.
          In the full orchestrator, this view will be backed by the jobs
          database and show status updates over time.
        </p>
      </header>

      <div className="space-y-3">
        {!hasRuns && (
          <p className="text-sm text-slate-500">
            No Library runs yet. Use “Use this workflow” on a Library item to
            start a run.
          </p>
        )}

        {hasRuns && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-slate-600">
                    Workflow
                  </th>
                  <th className="px-3 py-2 font-medium text-slate-600">
                    Status
                  </th>
                  <th className="px-3 py-2 font-medium text-slate-600">
                    Created at
                  </th>
                  <th className="px-3 py-2 font-medium text-slate-600">
                    Run ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((run) => {
                  const created = new Date(run.createdAt as any);
                  const createdDisplay = Number.isNaN(created.getTime())
                    ? String(run.createdAt)
                    : created.toLocaleString();

                  return (
                    <tr key={run.runId}>
                      <td className="px-3 py-2 align-top">
                        <Link
                          href={`/library/${run.slug}`}
                          className="text-xs font-medium text-slate-900 hover:underline"
                        >
                          {run.slug}
                        </Link>
                        <p className="text-[11px] text-slate-500">
                          {run.libraryItemId}
                        </p>
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-slate-700">
                        {run.status}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-slate-700">
                        {createdDisplay}
                      </td>
                      <td className="px-3 py-2 align-top font-mono text-[11px] text-slate-700">
                        <Link
                          href={`/library/runs/${encodeURIComponent(run.runId)}`}
                          className="hover:underline"
                        >
                          {run.runId}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Note: This view is powered by an in-memory buffer for local development.
        It will reset on server restart or deploy. The production orchestrator
        will store runs durably and stream updates.
      </p>

      <p className="text-xs text-slate-400">
        Tip: Use the Library page to start a run, then refresh this view to see
        it appear here. Click a Run ID to inspect that run.
      </p>
    </main>

      <p className="text-xs text-slate-400">
        Dev tip: You can also inspect any run ID directly at{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
          /dev/library/run-inspector
        </code>
        .
      </p>
    </main>
  );
}

