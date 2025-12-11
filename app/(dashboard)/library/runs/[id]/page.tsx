import Link from "next/link";
import { getRunDetail } from "@/server/orchestrator/runs";

export const dynamic = "force-dynamic";

export default async function LibraryRunDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const run = await getRunDetail(id);

  if (!run) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Run not found</h1>
        <p className="text-sm text-muted-foreground">
          No run could be found for id{" "}
          <code className="font-mono">{id}</code>.
        </p>
        <Link
          href="/library/runs"
          className="text-sm font-medium underline underline-offset-4"
        >
          Back to runs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/library/runs"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to runs
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {run.label}
        </h1>
        <p className="text-sm text-muted-foreground">
          Status{" "}
          <span className="font-mono rounded border px-1.5 py-0.5 text-xs">
            {run.status}
          </span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Timestamps</h2>
          <p className="text-xs text-muted-foreground">
            Created at: {new Date(run.createdAt).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            Updated at: {new Date(run.updatedAt).toLocaleString()}
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Workflow</h2>
          <p className="text-sm text-muted-foreground">
            {run.workflowSlug}
          </p>
        </div>
      </div>

      {run.inputSummary && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Input</h2>
          <p className="text-sm text-muted-foreground">
            {run.inputSummary}
          </p>
        </div>
      )}

      {run.outputSummary && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Output</h2>
          <p className="text-sm text-muted-foreground">
            {run.outputSummary}
          </p>
        </div>
      )}

      {run.errorMessage && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-destructive">Error</h2>
          <p className="text-sm text-destructive">
            {run.errorMessage}
          </p>
        </div>
      )}
    </div>
  );
}
