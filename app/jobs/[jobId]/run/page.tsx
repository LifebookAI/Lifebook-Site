import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobById, updateJob } from "@/lib/jobs/store";
import { createLabSessionFromJob } from "@/lib/labs/store";

interface JobRunParams {
  jobId: string;
}

interface JobRunPageProps {
  params: Promise<JobRunParams>;
}

export default async function JobRunPage({ params }: JobRunPageProps) {
  const { jobId } = await params;

  const job = getJobById(jobId);
  if (!job) {
    notFound();
  }

  // Mark job as running while we "materialize" the lab
  updateJob(job.id, { status: "running" });

  const session = createLabSessionFromJob(job);

  // Attach the sessionId to the job result and mark completed
  updateJob(job.id, {
    status: "completed",
    result: { sessionId: session.id },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Lab materialization</h1>
      <p className="mb-2 text-sm">
        Lab session created for{" "}
        <span className="font-medium">{job.stepTitle}</span> in track{" "}
        <span className="font-medium">{job.trackTitle}</span>.
      </p>
      <p className="mb-4 text-sm">
        You can find it in your{" "}
        <Link href="/library/labs" className="underline">
          Library — Lab Sessions
        </Link>{" "}
        or jump straight to the details page below.
      </p>

      <div className="mt-4 flex flex-col gap-2 text-sm">
        <Link
          href={`/library/labs/${session.id}`}
          className="underline"
        >
          View lab session details
        </Link>
        <Link href="/jobs" className="underline">
          Back to Jobs
        </Link>
      </div>
    </main>
  );
}