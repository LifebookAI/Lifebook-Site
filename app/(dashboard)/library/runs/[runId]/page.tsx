import Link from "next/link";

type RunDetailPageProps = {
  params: {
    runId: string;
  };
};

type ParsedRun = {
  runId: string;
  slug: string;
  libraryItemId: string;
  status: "pending";
  createdAt: Date | null;
};

function parseRunId(rawRunId: string): ParsedRun | null {
  let decoded = rawRunId;

  try {
    decoded = decodeURIComponent(rawRunId);
  } catch {
    // Fall back to the raw value if decodeURIComponent fails.
  }

  if (!decoded.startsWith("run_")) {
    return null;
  }

  const withoutPrefix = decoded.slice("run_".length);
  const lastUnderscore = withoutPrefix.lastIndexOf("_");

  if (lastUnderscore === -1) {
    return null;
  }

  const slug = withoutPrefix.slice(0, lastUnderscore);
  const timestampPart = withoutPrefix.slice(lastUnderscore + 1);

  const timestampMs = Number(timestampPart);
  const createdAt =
    Number.isFinite(timestampMs) && timestampMs > 0
      ? new Date(timestampMs)
      : null;

  const libraryItemId = `workflow.${slug}`;

  return {
    runId: decoded,
    slug,
    libraryItemId,
    status: "pending",
    createdAt,
  };
}

export default function LibraryRunDetailPage({ params }: RunDetailPageProps) {
  const parsed = parseRunId(params.runId);

  if (!parsed) {
    let decodedRunId = params.runId;
    try {
      decodedRunId = decodeURIComponent(params.runId);
    } catch {
      // ignore
    }

    return (
      <main className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Run not found
          </h1>
          <p className="max-w-xl text-sm text-slate-500">
            We could not interpret the Library run ID{" "}
            <span className="font-mono text-xs">{decodedRunId}</span>.
          </p>
        </header>
        <p className="text-sm">
          <Link
            href="/library/activity"
            className="text-sky-600 hover:underline"
          >
            Back to Library activity
          </Link>
        </p>
      </main>
    );
  }

  const createdDisplay =
    parsed.createdAt === null
      ? "Unknown"
      : parsed.createdAt.toLocaleString();

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Run details
        </h1>
        <p className="max-w-xl text-sm text-slate-500">
          Inspect the payload for a single Library run. For this MVP, details
          are reconstructed from the run ID. In the full orchestrator, this page
          will load runs from the jobs database and show live status updates and
          logs.
        </p>
      </header>

      <section className="space-y-4">
        <div className="max-w-xl rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Run ID
              </dt>
              <dd className="font-mono text-[11px] text-slate-800">
                {parsed.runId}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Workflow
              </dt>
              <dd className="text-sm text-slate-900">
                <Link
                  href={`/library/${parsed.slug}`}
                  className="font-medium text-sky-700 hover:underline"
                >
                  {parsed.slug}
                </Link>
                <p className="text-[11px] text-slate-500">
                  {parsed.libraryItemId}
                </p>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </dt>
              <dd className="text-sm text-slate-800">{parsed.status}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Created at
              </dt>
              <dd className="text-sm text-slate-800">{createdDisplay}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="space-y-2 text-xs text-slate-500">
        <p>
          Note: This view does not yet reflect live job execution. In the
          production orchestrator, runs will be stored durably and enriched with
          status transitions and logs.
        </p>
        <p>
          <Link
            href="/library/activity"
            className="font-medium text-sky-600 hover:underline"
          >
            Back to Library activity
          </Link>
        </p>
      </section>
    </main>
  );
}
