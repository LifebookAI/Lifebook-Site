import type { LibraryItemSummary } from "./types";
import type { LibraryStoreQuery } from "./store";

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
};

interface CreatePostgresLibraryStoreOptions {
  db: DbClient;
}

function mapRowToSummary(row: any): LibraryItemSummary {
  return {
    id: String(row.id),
    title: String(row.title),
    kind: row.kind,
    sourceType: row.source_type,
    project: row.project ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    isPinned: Boolean(row.is_pinned),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    lastViewedAt: row.last_viewed_at
      ? row.last_viewed_at instanceof Date
        ? row.last_viewed_at.toISOString()
        : String(row.last_viewed_at)
      : null,
  };
}

export function createPostgresLibraryStore({
  db,
}: CreatePostgresLibraryStoreOptions) {
  async function list(query: LibraryStoreQuery): Promise<LibraryItemSummary[]> {
    const { workspaceId, filters = {}, limit = 100, offset = 0 } = query;

    const values: unknown[] = [];
    const where: string[] = [];

    // Workspace scope is mandatory
    values.push(workspaceId);
    where.push(`workspace_id = $${values.length}`);

    if (filters.pinnedOnly) {
      values.push(true);
      where.push(`is_pinned = $${values.length}`);
    }

    if (filters.project) {
      values.push(filters.project);
      where.push(`project = $${values.length}`);
    }

    if (filters.tags && filters.tags.length > 0) {
      values.push(filters.tags);
      where.push(`tags && $${values.length}::text[]`);
    }

    if (filters.kind) {
      const kinds = Array.isArray(filters.kind) ? filters.kind : [filters.kind];
      values.push(kinds);
      where.push(`kind = ANY($${values.length}::text[])`);
    }

    if (filters.sourceType) {
      const sources = Array.isArray(filters.sourceType)
        ? filters.sourceType
        : [filters.sourceType];
      values.push(sources);
      where.push(`source_type = ANY($${values.length}::text[])`);
    }

    if (filters.query) {
      const needle = `%${filters.query.toLowerCase()}%`;
      values.push(needle);
      const idx = values.length;
      // Match title, project, or any tag (case-insensitive)
      where.push(
        `(lower(title) LIKE $${idx} OR lower(coalesce(project, '')) LIKE $${idx} OR EXISTS (SELECT 1 FROM unnest(tags) t WHERE lower(t) LIKE $${idx}))`,
      );
    }

    const orderBy =
      query.orderBy === "created_at_asc" ? "created_at ASC" : "created_at DESC";

    // Limit/offset placeholders
    values.push(limit);
    const limitIndex = values.length;
    values.push(offset);
    const offsetIndex = values.length;

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        id,
        workspace_id,
        title,
        kind,
        source_type,
        project,
        tags,
        is_pinned,
        created_at,
        last_viewed_at
      FROM library_items
      ${whereSql}
      ORDER BY ${orderBy}
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;

    try {
      const result = await db.query(sql, values);
      return result.rows.map(mapRowToSummary);
    } catch (err) {
      console.error("[library] Postgres list() failed; returning empty set", err);
      // In case of DB issues, surface an empty list rather than crashing the app.
      return [];
    }
  }

  async function getById(
    workspaceId: string,
    id: string,
  ): Promise<LibraryItemSummary | null> {
    const sql = `
      SELECT
        id,
        workspace_id,
        title,
        kind,
        source_type,
        project,
        tags,
        is_pinned,
        created_at,
        last_viewed_at
      FROM library_items
      WHERE workspace_id = $1 AND id = $2
      LIMIT 1;
    `;

    try {
      const result = await db.query(sql, [workspaceId, id]);
      if (!result.rows.length) {
        return null;
      }
      return mapRowToSummary(result.rows[0]);
    } catch (err) {
      console.error("[library] Postgres getById() failed; returning null", err);
      return null;
    }
  }

  return {
    list,
    getById,
  };
}
