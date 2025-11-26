/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import Link from "next/link";
import { headers } from "next/headers";

type JobStatus = string;

interface Job {
  id: string;
  stepTitle: string;
  templateId: string;
  trackTitle: string;
  status: JobStatus;
  createdAt: string;
  result?: unknown;
}

async function fetchJobs(): Promise<Job[]> {
  const hdrs = await headers();
  const host =
    hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const protocol = hdrs.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;

  const res = await fetch(`${baseUrl}/api/jobs`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch jobs: ${res.status}`);
  }

  return (await res.json()) as Job[];
}

function getSessionIdFromResult(result: unknown): string | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const maybeSessionId = (result as { sessionId?: unknown }).sessionId;
  if (typeof maybeSessionId !== "string") return null;

  const trimmed = maybeSessionId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default async function JobsPage() {
  const jobs = await fetchJobs();
  const hasJobs = jobs.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Jobs</h1>
      <p className="mb-4 text-sm">
        In-memory jobs for Study Tracks. J1 lab jobs can be run to create a lab
        session entry in your Library.
      </p>

      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border px-2 py-1 text-left">Step</th>
            <th className="border px-2 py-1 text-left">Track</th>
            <th className="border px-2 py-1 text-left">Job ID</th>
            <th className="border px-2 py-1 text-left">Status</th>
            <th className="border px-2 py-1 text-left">Created</th>
            <th className="border px-2 py-1 text-left">Result</th>
          </tr>
        </thead>
        <tbody>
          {hasJobs ? (
            jobs.map((job) => {
              const sessionId = getSessionIdFromResult(job.result);

              return (
                <tr key={job.id}>
                  <td className="border px-2 py-1 align-top">
                    <div className="font-medium">{job.stepTitle}</div>
                    <div className="text-xs text-muted-foreground">
                      template: {job.templateId}
                    </div>
                  </td>
                  <td className="border px-2 py-1 align-top">
                    {job.trackTitle}
                  </td>
                  <td className="border px-2 py-1 align-top">
                    <code className="text-xs">{job.id}</code>
                  </td>
                  <td className="border px-2 py-1 align-top">{job.status}</td>
                  <td className="border px-2 py-1 align-top">
                    {job.createdAt}
                  </td>
                  <td className="border px-2 py-1 align-top">
                    {sessionId ? (
                      <div className="flex flex-col gap-1">
                        <span>Result ready.</span>
                        <Link
                          href={`/library/labs/${sessionId}`}
                          className="underline"
                        >
                          View lab session
                        </Link>
                      </div>
                    ) : job.result ? (
                      <div className="flex flex-col gap-1">
                        <span>Result ready.</span>
                        <Link
                          href={`/jobs/${job.id}`}
                          className="underline"
                        >
                          View raw result
                        </Link>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span>No result yet.</span>
                        <Link
                          href={`/jobs/${job.id}/run`}
                          className="underline"
                        >
                          Run lab materialization
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={6} className="border px-2 py-2 text-sm">
                No jobs yet. Start a Study Track step to enqueue a lab job.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}