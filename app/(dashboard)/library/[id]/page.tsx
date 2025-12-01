import Link from 'next/link';
import { notFound } from 'next/navigation';

type LibraryItemType =
  | 'workflow'
  | 'capture'
  | 'note'
  | 'study-pack'
  | 'other';

interface LibraryItemDetail {
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
  bodyHtml?: string | null;
  bodyMarkdown?: string | null;
  rawText?: string | null;
}

interface LibraryItemResponse {
  item: LibraryItemDetail | null;
}

interface LibraryItemPageProps {
  params: {
    id: string;
  };
}

async function fetchLibraryItem(
  id: string,
): Promise<LibraryItemDetail | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000';

  const url = `${baseUrl}/api/library?id=${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as LibraryItemResponse;
  return data.item;
}

function formatDateFull(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function pickContent(item: LibraryItemDetail): {
  kind: 'html' | 'pre';
  value: string | null;
} {
  if (item.bodyHtml) {
    return { kind: 'html', value: item.bodyHtml };
  }
  if (item.bodyMarkdown) {
    return { kind: 'pre', value: item.bodyMarkdown };
  }
  if (item.rawText) {
    return { kind: 'pre', value: item.rawText };
  }
  if (item.summary) {
    return { kind: 'pre', value: item.summary };
  }
  return { kind: 'pre', value: null };
}

export default async function LibraryItemPage(
  props: LibraryItemPageProps,
): Promise<JSX.Element> {
  const id = decodeURIComponent(props.params.id);
  const item = await fetchLibraryItem(id);

  if (!item) {
    notFound();
  }

  const content = pickContent(item);

  return (
    <div className="space-y-6">
      <nav className="text-xs text-muted-foreground">
        <Link href="/library" className="hover:underline">
          ← Back to Library
        </Link>
      </nav>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {item.pinned ? (
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200">
              Pinned
            </span>
          ) : null}
          <h1 className="text-2xl font-semibold leading-tight">
            {item.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            {item.type}
          </span>
          {item.project ? (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
              {item.project}
            </span>
          ) : null}
          {item.tags?.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium"
            >
              {tag}
            </span>
          ))}
        </div>

        <dl className="mt-3 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
          <div>
            <dt className="font-medium text-foreground">Created</dt>
            <dd>{formatDateFull(item.createdAt)}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Last updated</dt>
            <dd>{formatDateFull(item.updatedAt)}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Last viewed</dt>
            <dd>{formatDateFull(item.lastViewedAt ?? null)}</dd>
          </div>
        </dl>

        {item.summary ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {item.summary}
          </p>
        ) : null}
      </header>

      <section className="rounded-xl border bg-card p-4 text-sm leading-relaxed">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Artifact
        </h2>

        {!content.value ? (
          <p className="text-sm text-muted-foreground">
            This library item does not have any attached content yet.
          </p>
        ) : content.kind === 'html' ? (
          <article
            className="prose max-w-none prose-sm dark:prose-invert"
            // Assumes bodyHtml is already sanitized by the backend.
            dangerouslySetInnerHTML={{ __html: content.value }}
          />
        ) : (
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md bg-muted/60 p-3 font-mono text-xs">
            {content.value}
          </pre>
        )}
      </section>
    </div>
  );
}
