import Link from 'next/link';
import { listRuns, type RunSummary } from '@/server/orchestrator/runs';

export const dynamic = 'force-dynamic';

export default async function LibraryRunsPage() {
  let runs: RunSummary[];

  try {
    runs = await listRuns();
  } catch (error) {
    console.error('LibraryRunsPage listRuns failed', error);
    throw error; // handled by app/library/runs/error.tsx
  }

  if (!runs.length) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Runs</h1>
        <p className="text-sm text-muted-foreground">
          No runs yet. Kick off a workflow to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Runs</h1>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr className="text-left">
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.id}
                className="border-b last:border-b-0 hover:bg-muted/40"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/library/runs/${run.id}`}
                    className="font-medium hover:underline"
                  >
                    {run.label}
                  </Link>
                </td>
                <td className="px-3 py-2 capitalize">{run.status}</td>
                <td className="px-3 py-2">
                  {new Date(run.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  {new Date(run.updatedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
