export const dynamic = "force-dynamic";

import { getLatestJ1LabSessions } from "@/lib/j1-lab-sessions";

export default async function J1LabsDevPage() {
  const sessions = await getLatestJ1LabSessions(10);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">J1 – Local Lab Sessions (Dev)</h1>
        <p className="text-sm text-muted-foreground">
          Latest lab_sessions joined with jobs from your local Postgres (Docker).
        </p>
      </header>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No lab sessions found yet. Run the seed script
          {" "}(<code className="font-mono text-xs">node infra/db/seed-j1-lab-session.cjs</code>)
          {" "}to create one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th>Created</th>
                <th>Track / Lab</th>
                <th>Job</th>
                <th>Session</th>
                <th>Session Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((row) => (
                <tr
                  key={row.session_id}
                  className="border-b border-border last:border-none"
                >
                  <td className="px-3 py-2 align-top">
                    <span className="font-mono text-xs">
                      {new Date(row.session_created_at).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-mono text-xs">{row.job_track}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {row.job_lab}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-mono text-xs">{row.job_kind}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.job_status ?? "unknown"}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      job id:{" "}
                      <span className="font-mono">{row.job_id}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="text-sm font-medium">
                      {row.session_title}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      session id:{" "}
                      <span className="font-mono">{row.session_id}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs capitalize">
                      {row.session_status ?? "unknown"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
