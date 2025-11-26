import Link from "next/link";
import { listLabSessions } from "@/lib/labs/store";

export default function LibraryLabsPage() {
  const sessions = listLabSessions();
  const hasSessions = sessions.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Library — Lab Sessions</h1>
      <p className="mb-4 text-sm">
        These are saved lab session artifacts from your Study Tracks. Each entry
        comes from a job run and links to its full checklist and details.
      </p>

      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border px-2 py-1 text-left">Lab step</th>
            <th className="border px-2 py-1 text-left">Track</th>
            <th className="border px-2 py-1 text-left">Outcome</th>
            <th className="border px-2 py-1 text-left">Completed</th>
            <th className="border px-2 py-1 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {hasSessions ? (
            sessions.map((session) => (
              <tr key={session.id}>
                <td className="border px-2 py-1 align-top">
                  <div className="font-medium">{session.stepTitle}</div>
                  <div className="text-xs text-muted-foreground">
                    template: {session.templateId}
                  </div>
                </td>
                <td className="border px-2 py-1 align-top">
                  {session.trackTitle}
                </td>
                <td className="border px-2 py-1 align-top">
                  {session.outcome}
                </td>
                <td className="border px-2 py-1 align-top">
                  {session.completedAt}
                </td>
                <td className="border px-2 py-1 align-top">
                  <Link
                    href={`/library/labs/${session.id}`}
                    className="underline"
                  >
                    View details
                  </Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={5}
                className="border px-2 py-2 text-sm"
              >
                No lab session artifacts yet. Run a J1 AWS lab job and then hit
                this page again.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}