import Link from "next/link";
import { getLibraryItems, type LibraryItem, type LibraryStatus } from "@/lib/library/catalog";

/**
 * /library
 *
 * Phase 4 / Step 19B — Personal Library (search & recall)
 * Server-rendered Library index backed by data/library/catalog.v1.json.
 */

const statusStyles: Record<LibraryStatus, string> = {
  draft:
    "bg-yellow-500/10 text-yellow-600 ring-1 ring-yellow-500/30",
  beta:
    "bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/30",
  stable:
    "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/30",
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

export const metadata = {
  title: "Library | Lifebook",
};

type LibraryPageProps = {
  searchParams?: {
    q?: string;
  };
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const rawQuery = (searchParams?.q ?? "").trim();
  const query = rawQuery.toLowerCase();

  const allItems = getLibraryItems().sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );

  const items =
    query.length === 0
      ? allItems
      : allItems.filter((item) => {
          const haystack = [
            item.title,
            item.description,
            item.slug,
            item.id,
            item.kind,
            ...(item.tags ?? []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(query);
        });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <div className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">
            Library
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Saved workflows & study tracks
          </h1>
          <p className="max-w-2xl text-sm text-slate-600">
            This is the seed catalog for your Lifebook Library. Each card
            represents a workflow template or study track that can be activated,
            pinned, and tracked for Weekly Executed Automations per Workspace
            (WEA/AW).
          </p>
        </div>

        <form
          action="/library"
          method="GET"
          className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm shadow-slate-900/5"
        >
          <input
            type="text"
            name="q"
            defaultValue={rawQuery}
            placeholder="Filter by title, tags, or kind (e.g. 'workflow', 'SAA')"
            className="h-8 w-full border-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
          />
          {rawQuery && (
            <Link
              href="/library"
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Clear
            </Link>
          )}
        </form>

        {rawQuery && (
          <p className="text-xs text-slate-500">
            Showing {items.length} of {allItems.length} items for{" "}
            <span className="font-mono text-slate-700">"{rawQuery}"</span>.
          </p>
        )}
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/library/${item.slug}`}
            className="group"
          >
            <article className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/10">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
                      {kindLabel(item.kind)}
                    </p>
                    <h2 className="text-base font-semibold tracking-tight text-slate-900 group-hover:text-slate-950">
                      {item.title}
                    </h2>
                  </div>
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      statusStyles[item.status],
                    ].join(" ")}
                  >
                    {item.status}
                  </span>
                </div>

                <p className="text-sm text-slate-600">
                  {item.description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                <div className="flex flex-wrap gap-1.5">
                  {item.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <code className="rounded-md bg-slate-900/90 px-2 py-0.5 text-[10px] font-mono text-slate-100">
                  {item.id}
                </code>
              </div>
            </article>
          </Link>
        ))}
      </section>

      <footer className="border-t border-dashed border-slate-200 pt-4 text-xs text-slate-500">
        <p>
          Backed by{" "}
          <code className="rounded bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-100">
            data/library/catalog.v1.json
          </code>{" "}
          via{" "}
          <code className="rounded bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-100">
            lib/library/catalog.ts
          </code>
          . Add new workflows and tracks by editing the catalog and
          re-running your tests.
        </p>
      </footer>
    </main>
  );
}
