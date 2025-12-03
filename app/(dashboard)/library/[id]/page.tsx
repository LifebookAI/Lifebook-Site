import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLibraryItems,
  type LibraryItem,
  type LibraryStatus,
} from "@/lib/library/catalog";
import { LibraryDetailClient } from "./LibraryDetailClient";

/**
 * /library/[id]
 *
 * Phase 4 / Step 19B — Personal Library (search & recall)
 * Detail view for a single Library item (workflow template or study track).
 */

const statusStyles: Record<LibraryStatus, string> = {
  draft: "bg-yellow-500/10 text-yellow-600 ring-1 ring-yellow-500/30",
  beta: "bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/30",
  stable: "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/30",
};

function kindLabel(kind: LibraryItem["kind"]): string {
  switch (kind) {
    case "workflow-template":
      return "Workflow template";
    case "study-track":
      return "Study track";
    default:
      return kind;
  }
}

type LibraryDetailPageProps = {
  params: {
    id: string;
  };
};

export const metadata = {
  title: "Library item | Lifebook",
};

export default async function LibraryDetailPage({
  params,
}: LibraryDetailPageProps) {
  const slug = params.id;

  const item = getLibraryItems().find((entry) => entry.slug === slug);

  if (!item) {
    notFound();
  }

  const isWorkflow = item.kind === "workflow-template";
  const isTrack = item.kind === "study-track";
  const isRunnable = isWorkflow;

  const primaryCtaLabel = isTrack
    ? "Start this track"
    : isWorkflow
    ? "Use this workflow"
    : "Activate";

  const primaryCtaHint = isTrack
    ? "Track enrollment isn't wired up yet in this MVP. For now, use this page as a reference for what the track covers."
    : isWorkflow
    ? "In the MVP, this will create a run with your inputs, send it to the orchestrator queue, and save the output into your Library."
    : "In the MVP, this will attach this Library item to a workspace so you can track automations.";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">
          Library
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {item.title}
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">{item.description}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span
            className={[
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              statusStyles[item.status],
            ].join(" ")}
          >
            {item.status}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600">
            {kindLabel(item.kind)}
          </span>
          <code className="rounded bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-100">
            {item.id}
          </code>
        </div>
      </header>

      <LibraryDetailClient
        slug={item.slug}
        primaryCtaLabel={primaryCtaLabel}
        primaryCtaHint={primaryCtaHint}
        isRunnable={isRunnable}
      />

      <section className="border-t border-dashed border-slate-200 pt-4 text-xs text-slate-500 space-y-2">
        {item.tags && item.tags.length > 0 && (
          <p className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
              >
                {tag}
              </span>
            ))}
          </p>
        )}

        <p>
          <Link
            href="/library"
            className="text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            ← Back to Library
          </Link>
        </p>
      </section>
    </main>
  );
}
