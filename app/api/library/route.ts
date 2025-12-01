import { NextRequest, NextResponse } from 'next/server';
import { listLibraryItems, getLibraryItemById } from '@/lib/library/server';

type LibrarySort = 'recent' | 'oldest';

interface LibraryItem {
  id: string;
  title: string;
  type: 'workflow' | 'capture' | 'note' | 'study-pack' | 'other';
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  lastViewedAt?: string | null;
  summary?: string | null;
  project?: string | null;
  pinned?: boolean;
  bodyHtml?: string | null;
  bodyMarkdown?: string | null;
  rawText?: string | null;
}

interface ListParams {
  q?: string;
  type?: string;
  tag?: string;
  sort?: LibrarySort;
  limit?: number;
  offset?: number;
}

type LibraryListResult = LibraryItem[] | { items: LibraryItem[] };
type ListFn = (params: ListParams) => Promise<unknown>;
type GetFn = (id: string) => Promise<unknown>;

const rawListLibraryItems: unknown = listLibraryItems;
const rawGetLibraryItemById: unknown = getLibraryItemById;

// ----- Type guards -----

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isLibraryItem(value: unknown): value is LibraryItem {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    id?: unknown;
    title?: unknown;
    type?: unknown;
    tags?: unknown;
  };

  if (typeof candidate.id !== 'string') return false;
  if (typeof candidate.title !== 'string') return false;
  if (typeof candidate.type !== 'string') return false;

  if (candidate.tags !== undefined && !isStringArray(candidate.tags)) {
    return false;
  }

  return true;
}

function isLibraryItemArray(value: unknown): value is LibraryItem[] {
  return Array.isArray(value) && value.every((entry) => isLibraryItem(entry));
}

function isLibraryListResult(value: unknown): value is LibraryListResult {
  if (isLibraryItemArray(value)) {
    return true;
  }

  if (value === null || typeof value !== 'object') {
    return false;
  }

  if (!('items' in value)) {
    return false;
  }

  const candidate = value as { items?: unknown };
  return isLibraryItemArray(candidate.items);
}

function isListFn(value: unknown): value is ListFn {
  return typeof value === 'function';
}

function isGetFn(value: unknown): value is GetFn {
  return typeof value === 'function';
}

// ----- Dev-only seed items -----

function isDevEnv(): boolean {
  return process.env.NODE_ENV !== 'production';
}

const DEV_LIBRARY_ITEMS: ReadonlyArray<LibraryItem> = [
  {
    id: 'dev-sample-hello-world',
    title: 'Sample workflow run · hello world',
    type: 'workflow',
    tags: ['dev', 'sample', 'orchestrator'],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    lastViewedAt: null,
    summary:
      'Dev-only sample item to exercise the Personal Library UI. Wire /lib/library/server.ts to your real data source to replace this.',
    project: 'Playground',
    pinned: true,
    bodyHtml: null,
    bodyMarkdown:
      '# Dev sample item\n\nThis is a dev-only placeholder.\n\nOnce the real library backend is wired, this item should disappear.',
    rawText: null,
  },
];

function normalizeSort(sort: LibrarySort | undefined): LibrarySort {
  return sort === 'oldest' || sort === 'recent' ? sort : 'recent';
}

function getDevLibraryItemsFiltered(params: ListParams): LibraryItem[] {
  if (!isDevEnv()) return [];

  const sort = normalizeSort(params.sort);
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  let items = [...DEV_LIBRARY_ITEMS];

  if (params.type) {
    items = items.filter((item) => item.type === params.type);
  }

  if (params.tag) {
    items = items.filter((item) => item.tags?.includes(params.tag ?? '') ?? false);
  }

  if (params.q) {
    const needle = params.q.toLowerCase();
    items = items.filter((item) => {
      const haystack = [
        item.title,
        item.summary ?? '',
        item.project ?? '',
        ...(item.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }

  items.sort((a, b) => {
    const aDate = (a.updatedAt ?? a.createdAt) ?? '';
    const bDate = (b.updatedAt ?? b.createdAt) ?? '';
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;

    const aTime = Date.parse(aDate);
    const bTime = Date.parse(bDate);

    if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;

    return sort === 'recent' ? bTime - aTime : aTime - bTime;
  });

  const start = Math.max(0, offset);
  const end = Math.max(start, start + limit);

  return items.slice(start, end);
}

function getDevLibraryItemById(id: string): LibraryItem | null {
  if (!isDevEnv()) return null;
  return DEV_LIBRARY_ITEMS.find((item) => item.id === id) ?? null;
}

// ----- Wrappers around backend + dev fallback -----

async function fetchLibraryItemById(id: string): Promise<LibraryItem | null> {
  if (!isGetFn(rawGetLibraryItemById)) {
    // Backend not wired yet; fall back to dev seed (if enabled)
    return getDevLibraryItemById(id);
  }

  let raw: unknown;
  try {
    raw = await rawGetLibraryItemById(id);
  } catch {
    // Backend threw; fall back to dev seed in non-production
    const devItem = getDevLibraryItemById(id);
    if (devItem) return devItem;
    return null;
  }

  if (raw == null) {
    const devItem = getDevLibraryItemById(id);
    if (devItem) return devItem;
    return null;
  }

  if (!isLibraryItem(raw)) {
    // Unexpected shape; prefer dev seed in dev, otherwise treat as missing
    const devItem = getDevLibraryItemById(id);
    if (devItem) return devItem;
    return null;
  }

  return raw;
}

async function fetchLibraryItems(params: ListParams): Promise<LibraryItem[]> {
  if (!isListFn(rawListLibraryItems)) {
    // Backend not wired yet; fall back to dev seed (if any)
    return getDevLibraryItemsFiltered(params);
  }

  let raw: unknown;
  try {
    raw = await rawListLibraryItems(params);
  } catch {
    // Backend threw; fall back to dev seed in non-production
    return getDevLibraryItemsFiltered(params);
  }

  if (!isLibraryListResult(raw)) {
    // Unexpected shape; treat as empty in prod, dev seed in dev
    return getDevLibraryItemsFiltered(params);
  }

  if (Array.isArray(raw)) {
    return raw;
  }

  return raw.items;
}

// ----- Route handler -----

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  // Detail: ?id=...
  if (id) {
    const item = await fetchLibraryItemById(id);
    if (!item) {
      return new NextResponse('Not found', { status: 404 });
    }
    return NextResponse.json({ item });
  }

  // List: search + filters
  const q = searchParams.get('q') ?? undefined;
  const type = searchParams.get('type') ?? undefined;
  const tag = searchParams.get('tag') ?? undefined;

  const sortParam = searchParams.get('sort');
  const sort: LibrarySort =
    sortParam === 'oldest' || sortParam === 'recent' ? sortParam : 'recent';

  const limitRaw = searchParams.get('limit');
  const offsetRaw = searchParams.get('offset');

  const limit = Math.min(limitRaw ? Number(limitRaw) : 50, 100);
  const offset = offsetRaw ? Number(offsetRaw) : 0;

  const params: ListParams = { q, type, tag, sort, limit, offset };

  const items = await fetchLibraryItems(params);

  return NextResponse.json({ items });
}
