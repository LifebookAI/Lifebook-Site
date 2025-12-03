import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  getLibraryItems,
  type LibraryItem,
  type LibraryStatus,
} from "@/lib/library/catalog";

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

const statusStyles: Record<LibraryStatus, string> = {
  draft:
    "bg-yellow-500/10 text-yellow-600 ring-1 ring-yellow-500/30",
  beta:
    "bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/30",
  stable:
    "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/30",
};

interface LibraryItemPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata(
  { params }: LibraryItemPageProps,
): Promise<Metadata> {
  const items = getLibraryItems();
  const item = items.find((entry) => entry.slug === params.id);

  if (!item) {
    return {
      title: "Library item not found · Lifebook",
    };
  }

  return {
    title: `${item.title} · Library · Lifebook`,
  };
}

export default async function LibraryItemPage({
  params,
}: LibraryItemPageProps) {
  const items = getLibraryItems();
  const item = items.find((entry) => entry.slug === params.id);

  if (!item) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/library"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          <span aria-hidden>←</span>
          <span className="ml-1">Back to Library</span>
        </Link>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm shadow-slate-900/5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
              {kindLabel(item.kind)}
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {item.title}
            </h1>
          </div>
          <span
            className={[
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              statusStyles[item.status],
            ].join(" ")}
          >
            {item.status}
          </span>
        </header>

        <p className="mt-4 text-sm text-slate-700">
          {item.description}
        </p>

        <dl className="mt-6 space-y-2 text-xs text-slate-500">
          <div className="flex gap-2">
            <dt className="w-20 font-medium">ID</dt>
            <dd>
              <code className="rounded bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-100">
                {item.id}
              </code>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 font-medium">Slug</dt>
            <dd>{item.slug}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 font-medium">Tags</dt>
            <dd className="flex flex-wrap gap-1.5">
              {item.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                >
                  {tag}
                </span>
              )) ?? "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-500">
          <p className="font-medium text-slate-600">
            Activation placeholder
          </p>
          <p className="mt-1">
            In a later step, this page will show run history, pinned artifacts,
            and quick actions for this workflow or study track.
          </p>
        </div>
      </article>
    </main>
  );
}

export async function generateStaticParams() {
  const items = getLibraryItems();
  return items.map((item) => ({ id: item.slug }));
}
