import { S3Client, ListObjectsV2Command, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

export type LibrarySort = 'recent' | 'oldest';

export type LibraryItemType =
  | 'workflow'
  | 'capture'
  | 'note'
  | 'study-pack'
  | 'other';

export interface LibraryItem {
  id: string;
  title: string;
  type: LibraryItemType;
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

export interface ListParams {
  q?: string;
  type?: string;
  tag?: string;
  sort?: LibrarySort;
  limit?: number;
  offset?: number;
}

const BUCKET = process.env.LIFEBOOK_S3_BUCKET ?? 'lifebook.ai';
const WORKFLOW_PREFIX =
  process.env.LIFEBOOK_WORKFLOW_RESULTS_PREFIX ?? 'workflows/manual/';
const REGION = process.env.AWS_REGION ?? 'us-east-1';

// S3 client uses the default credential chain (profile in dev, role in prod)
const s3Client = new S3Client({ region: REGION });

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function normalizeSort(sort: LibrarySort | undefined): LibrarySort {
  return sort === 'oldest' || sort === 'recent' ? sort : 'recent';
}

function parseWorkflowKey(key: string | undefined): { id: string } | null {
  if (!key) return null;
  // Example key: workflows/manual/job-4ff96f37-cd09-4cc1-8416-794d9b44beaf/result.md
  const match = key.match(/^workflows\/manual\/([^/]+)\/result\.md$/);
  if (!match) return null;
  const runId = match[1]; // e.g., "job-4ff96f37-..."
  return { id: runId };
}

function filterBySearch(items: LibraryItem[], q: string | undefined): LibraryItem[] {
  if (!q) return items;
  const needle = q.toLowerCase();

  return items.filter((item) => {
    const parts: string[] = [
      item.id,
      item.title,
      item.summary ?? '',
      item.project ?? '',
      ...(item.tags ?? []),
    ];
    return parts.join(' ').toLowerCase().includes(needle);
  });
}

function filterByType(items: LibraryItem[], type: string | undefined): LibraryItem[] {
  if (!type) return items;
  // For now only "workflow" is backed by S3.
  if (type !== 'workflow') {
    return [];
  }
  return items.filter((item) => item.type === 'workflow');
}

function filterByTag(items: LibraryItem[], tag: string | undefined): LibraryItem[] {
  if (!tag) return items;
  return items.filter((item) => item.tags?.includes(tag) ?? false);
}

function sortItems(items: LibraryItem[], sort: LibrarySort | undefined): LibraryItem[] {
  const normalized = normalizeSort(sort);
  const copy = [...items];

  copy.sort((a, b) => {
    const aDate = a.updatedAt ?? a.createdAt ?? '';
    const bDate = b.updatedAt ?? b.createdAt ?? '';
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;

    const aTime = Date.parse(aDate);
    const bTime = Date.parse(bDate);
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;

    return normalized === 'recent' ? bTime - aTime : aTime - bTime;
  });

  return copy;
}

function paginateItems(
  items: LibraryItem[],
  limit: number | undefined,
  offset: number | undefined,
): LibraryItem[] {
  const safeLimit = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const safeOffset = Math.max(offset ?? 0, 0);
  const start = safeOffset;
  const end = safeOffset + safeLimit;
  return items.slice(start, end);
}

async function streamToString(body: unknown): Promise<string> {
  if (!body || typeof (body as { on?: unknown }).on !== 'function') {
    return '';
  }

  const readable = body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];

  return new Promise<string>((resolve, reject) => {
    readable.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    readable.on('error', reject);
    readable.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
  });
}

function extractMetadataFromMarkdown(
  runId: string,
  bodyText: string | null,
): { title: string; summary: string | null } {
  const fallbackTitle = `Workflow run · ${runId}`;

  if (!bodyText || !bodyText.trim()) {
    return { title: fallbackTitle, summary: null };
  }

  const firstNonEmptyLine =
    bodyText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? '';

  const title = firstNonEmptyLine.replace(/^#+\s*/, '') || fallbackTitle;

  const summary =
    bodyText.length > 280 ? `${bodyText.slice(0, 277)}…` : bodyText;

  return { title, summary };
}

async function listWorkflowResultsFromS3(): Promise<LibraryItem[]> {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: WORKFLOW_PREFIX,
    MaxKeys: 200,
  });

  const output = await s3Client.send(command);
  const contents = output.Contents ?? [];

  const items: LibraryItem[] = [];

  for (const obj of contents) {
    const parsed = parseWorkflowKey(obj.Key);
    if (!parsed || !obj.Key) continue;

    const runId = parsed.id;

    const createdAt = obj.LastModified?.toISOString();
    const updatedAt = createdAt;

    let bodyText: string | null = null;
    try {
      const getOutput = await s3Client.send(
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: obj.Key,
        }),
      );
      const text = await streamToString(getOutput.Body);
      bodyText = text || null;
    } catch {
      // Per-object failures shouldn't break the whole list; ignore and keep a minimal item.
    }

    const { title, summary } = extractMetadataFromMarkdown(runId, bodyText);

    items.push({
      id: runId,
      title,
      type: 'workflow',
      tags: ['workflow'],
      createdAt,
      updatedAt,
      summary,
      project: null,
      pinned: false,
      bodyHtml: null,
      bodyMarkdown: bodyText,
      rawText: bodyText,
    });
  }

  return items;
}

export async function listLibraryItems(params: ListParams): Promise<LibraryItem[]> {
  const all = await listWorkflowResultsFromS3();

  let items = all;
  items = filterByType(items, params.type);
  items = filterByTag(items, params.tag);
  items = filterBySearch(items, params.q);
  items = sortItems(items, params.sort);

  return paginateItems(items, params.limit, params.offset);
}

export async function getLibraryItemById(id: string): Promise<LibraryItem | null> {
  const runId = id.startsWith('job-') ? id : `job-${id}`;
  const key = `${WORKFLOW_PREFIX}${runId}/result.md`;

  try {
    const headOutput = await s3Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }),
    );

    const getOutput = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }),
    );

    const text = await streamToString(getOutput.Body);
    const bodyText = text || null;

    const updatedAt = headOutput.LastModified?.toISOString();
    const createdAt = updatedAt;

    const { title, summary } = extractMetadataFromMarkdown(runId, bodyText);

    const item: LibraryItem = {
      id: runId,
      title,
      type: 'workflow',
      tags: ['workflow'],
      createdAt,
      updatedAt,
      lastViewedAt: null,
      summary,
      project: null,
      pinned: false,
      bodyHtml: null,
      bodyMarkdown: bodyText,
      rawText: bodyText,
    };

    return item;
  } catch (error) {
    // 404 -> treat as missing; other errors bubble so the API route can fall back to dev seed.
    const maybeError = error as { $metadata?: { httpStatusCode?: number } };
    if (maybeError.$metadata?.httpStatusCode === 404) {
      return null;
    }

    throw error;
  }
}
