import Link from "next/link";
import { notFound } from "next/navigation";
import { getLabSessionById } from "@/lib/labs/store";

interface LabSessionPageParams {
  sessionId: string;
}

interface LabSessionPageProps {
  params: Promise<LabSessionPageParams>;
}

export default async function LabSessionPage({
  params,
}: LabSessionPageProps) {
  const { sessionId } = await params;
  const session = getLabSessionById(sessionId);

  if (!session) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-3">Lab session details</h1>

      <p className="mb-4 text-sm">
        <span className="font-medium">Track:</span> {session.trackTitle}
        <br />
        <span className="font-medium">Step:</span> {session.stepTitle}
      </p>

      <dl className="mb-4 text-sm space-y-1">
        <div>
          <dt className="font-medium">Outcome</dt>
          <dd>{session.outcome}</dd>
        </div>
        <div>
          <dt className="font-medium">Completed at</dt>
          <dd>{session.completedAt}</dd>
        </div>
        <div>
          <dt className="font-medium">Job ID</dt>
          <dd>
            <code className="text-xs">{session.jobId}</code>
          </dd>
        </div>
      </dl>

      {session.checklist.length > 0 && (
        <section className="mb-4">
          <h2 className="text-sm font-semibold mb-2">Checklist</h2>
          <ol className="list-decimal pl-5 text-sm space-y-1">
            {session.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-4 flex flex-col gap-2 text-sm">
        <Link href="/library/labs" className="underline">
          Back to Library — Lab Sessions
        </Link>
        <Link href="/jobs" className="underline">
          Back to Jobs
        </Link>
      </div>
    </main>
  );
}