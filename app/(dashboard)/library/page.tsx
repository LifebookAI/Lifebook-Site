import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Personal Library · Lifebook',
};

type LibraryItemType =
  | 'workflow'
  | 'capture'
  | 'note'
  | 'study-pack'
  | 'other';

interface LibraryItem {
  id: string;
  title: string;
  type: LibraryItemType;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastViewedAt?: string | null;
  summary?: string | null;
  project?: string | null;
  pinned?: boolean;
}

interface LibraryListResponse {
  items: LibraryItem[];
}

interface LibraryPageSearchParams {
  q?: string;
  type?: string;
  tag?: string;
  sort?: 'recent' | 'oldest';
}

interface LibraryPageProps {
  searchParams?: LibraryPageSearchParams;
}

async function fetchLibraryItems(
  searchParams: LibraryPageSearchParams | undefined,
): Promise<LibraryItem[]> {
  const params = new URLSearchParams();

  if (searchParams?.q) params.set('q', searchParams.q);
  if (searchParams?.type) params.set('type', searchParams.type);
  if (searchParams?.tag) params.set('tag', searchParams.tag);
  if (searchParams?.sort) params.set('sort', searchParams.sort);

  const queryString = params.toString();

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000';

  const url =
    queryString.length > 0
      ? `${baseUrl}/api/library?${queryString}`
      : `${baseUrl}/api/library`;

  const res = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!res.ok) {
    // TODO: log to observability pipeline
    return [];
  }

  const data = (await res.json()) as LibraryListResponse;
  return data.items;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

export default async function LibraryPage(
  props: LibraryPageProps,
): Promise<JSX.Element> {
  const searchParams = props.searchParams;
  const items = await fetchLibraryItems(searchParams);

  const q = searchParams?.q ?? '';
  const type = searchParams?.type ?? '';
  const tag = searchParams?.tag ?? '';
  const sort = searchParams?.sort ?? 'recent';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Personal Library
          </h1>
          <p className="text-sm text-muted-foreground">
            All of your workflow artifacts, captures, and study packs in one
            place. Search, filter, and jump back into what matters.
          </p>
        </div>
      </header>

      <form
        className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-end"
        method="get"
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="q"
            className="text-xs font-medium text-muted-foreground"
          >
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Search by title, tags, or content…"
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="type"
            className="text-xs font-medium text-muted-foreground"
          >
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">All types</option>
            <option value="workflow">Workflow run</option>
            <option value="study-pack">Study pack</option>
            <option value="capture">Capture</option>
            <option value="note">Note</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="tag"
            className="text-xs font-medium text-muted-foreground"
          >
            Tag
          </label>
          <input
            id="tag"
            name="tag"
            defaultValue={tag}
            placeholder="Optional tag filter"
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="sort"
            className="text-xs font-medium text-muted-foreground"
          >
            Sort
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="recent">Most recent first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </form>

      <section className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {items.length}{' '}
            {items.length === 1 ? 'result' : 'results'}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              No library items match your filters.
            </p>
            <p className="mt-1">
              Try widening your search, or run a workflow or capture to seed the
              library.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/50"
              >
                <Link
                  href={`/library/${encodeURIComponent(item.id)}`}
                  className="block space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {item.pinned ? (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200">
                        Pinned
                      </span>
                    ) : null}
                    <h2 className="text-sm font-semibold leading-snug">
                      {item.title}
                    </h2>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {item.type}
                    </span>
                    {item.project ? (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                        {item.project}
                      </span>
                    ) : null}
                    {item.tags?.slice(0, 3).map((tagValue) => (
                      <span
                        key={tagValue}
                        className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium"
                      >
                        {tagValue}
                      </span>
                    ))}
                    {item.tags && item.tags.length > 3 ? (
                      <span className="text-[10px] text-muted-foreground">
                        +{item.tags.length - 3} more
                      </span>
                    ) : null}
                  </div>

                  {item.summary ? (
                    <p className="text-xs text-muted-foreground">
                      {item.summary}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    <span>Created {formatDate(item.createdAt)}</span>
                    <span>Updated {formatDate(item.updatedAt)}</span>
                    <span>
                      Last viewed{' '}
                      {item.lastViewedAt
                        ? formatDate(item.lastViewedAt)
                        : '—'}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
