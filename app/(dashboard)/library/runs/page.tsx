import Link from "next/link";
import { getLibraryRuns } from "@/lib/library/runs";

function formatTimestamp(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

type LibraryRunsPageProps = {
  searchParams?: {
    q?: string;
  };
};

export default async function LibraryRunsPage({
  searchParams,
}: LibraryRunsPageProps) {
  const rawQuery =
    typeof searchParams?.q === "string" ? searchParams.q : "";
  const searchQuery = rawQuery.trim();
  const hasSearch = searchQuery.length > 0;

  const runs = await getLibraryRuns({
    search: hasSearch ? searchQuery : undefined,
  });

  if (runs.length === 0) {
    return (
      <main className="space-y-6">
        <header className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Personal Library runs
            </h1>
            <p className="text-sm text-muted-foreground">
              Recent workflow runs stored in your Personal Library. When your
              workflows or captures run, their outputs will show up here.
            </p>
          </div>

          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
            method="GET"
          >
            <input
              type="search"
              name="q"
              defaultValue={searchQuery}
              placeholder="Search runs by label…"
              className="w-full rounded-md border bg-background px-2 py-1 text-sm shadow-sm"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="rounded-md border px-3 py-1 text-xs font-medium"
              >
                Search
              </button>
              {hasSearch ? (
                <Link
                  href="/library/runs"
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        </header>

        <p className="text-sm text-muted-foreground">
          {hasSearch ? (
            <>
              No runs match "{searchQuery}". Try a different search or{" "}
              <Link
                href="/library/runs"
                className="underline underline-offset-2"
              >
                clear the filter
              </Link>
              .
            </>
          ) : (
            "No runs yet. Start by running a workflow or capture to create your first Library artifact."
          )}
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <header className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Personal Library runs
          </h1>
          <p className="text-sm text-muted-foreground">
            Recent workflow runs stored in your Personal Library. When configured
            with a database, this view shows real runs for your workspace and
            falls back to stub data in development.
          </p>
        </div>

        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
          method="GET"
        >
          <input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search runs by label…"
            className="w-full rounded-md border bg-background px-2 py-1 text-sm shadow-sm"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-md border px-3 py-1 text-xs font-medium"
            >
              Search
            </button>
            {hasSearch ? (
              <Link
                href="/library/runs"
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                Clear
              </Link>
            ) : null}
          </div>
        </form>
      </header>

      <section className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
          <div>Run</div>
          <div>Status</div>
          <div>Last updated</div>
        </div>

        <div>
          {runs.map((run) => {
            const lastUpdated = run.completedAt ?? run.startedAt;

            return (
              <Link
                key={run.id}
                href={`/library/runs/${run.id}`}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <div className="truncate">{run.label}</div>
                <div className="uppercase text-xs tracking-wide">
                  {run.status}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {lastUpdated ? formatTimestamp(lastUpdated) : "—"}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}