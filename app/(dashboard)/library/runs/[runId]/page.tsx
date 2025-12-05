import type { Metadata } from "next";

type RunDetailPageProps = {
  params: {
    runId: string;
  };
};

export const metadata: Metadata = {
  title: "Library run details | Lifebook",
};

export default function LibraryRunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = params;

  return (
    <main className="flex flex-col gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Run details
        </h1>
        <p className="text-sm text-muted-foreground">
          Early preview of Library workflow run details. This view will show
          richer history and output in a later phase.
        </p>
      </header>

      <section className="rounded-xl border p-4 bg-background">
        <p className="text-xs font-mono uppercase text-muted-foreground">
          Run ID
        </p>
        <p className="mt-1 font-mono text-sm break-all">
          {runId}
        </p>
      </section>
    </main>
  );
}
