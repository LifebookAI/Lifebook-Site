/**
 * lib/library/store-postgres.ts
 *
 * Postgres-backed implementation of the LibraryStore.
 * Wires the library_items table into the read-only LibraryStore contract.
 *
 * NOTE:
 * - This expects a db object with a node-postgres–style `query` method:
 *     query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>
 * - The route/api layer will supply the actual db instance later.
 */

import type {
  LibraryItemRow,
  LibraryItemSummary,
} from "./types";
import type { CreateLibraryStore, LibraryStoreQuery } from "./store";

type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
};

function rowToSummary(row: LibraryItemRow): LibraryItemSummary {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    sourceType: row.sourceType,
    project: row.project,
    tags: row.tags ?? [],
    isPinned: row.isPinned,
    createdAt: row.createdAt,
    lastViewedAt: row.lastViewedAt ?? null,
  };
}

/**
 * Translate LibraryStoreQuery into WHERE/ORDER BY/limit/offset for library_items.
 */
function buildListQuery(q: LibraryStoreQuery): {
  sql: string;
  params: any[];
} {
  const { workspaceId, filters, limit = 50, offset = 0, orderBy = "created_at_desc" } = q;

  const whereParts: string[] = [];
  const params: any[] = [];
  let i = 1;

  // Workspace scope is mandatory
  whereParts.push(`workspace_id = $${i++}`);
  params.push(workspaceId);

  if (filters?.pinnedOnly) {
    whereParts.push(`is_pinned = true`);
  }

  if (filters?.kind) {
    if (Array.isArray(filters.kind)) {
      whereParts.push(`kind = ANY($${i++})`);
      params.push(filters.kind);
    } else {
      whereParts.push(`kind = $${i++}`);
      params.push(filters.kind);
    }
  }

  if (filters?.sourceType) {
    if (Array.isArray(filters.sourceType)) {
      whereParts.push(`source_type = ANY($${i++})`);
      params.push(filters.sourceType);
    } else {
      whereParts.push(`source_type = $${i++}`);
      params.push(filters.sourceType);
    }
  }

  if (filters?.tags && filters.tags.length > 0) {
    // tags && ARRAY[...] — overlap operator on text[]
    whereParts.push(`tags && $${i++}::text[]`);
    params.push(filters.tags);
  }

  if (filters?.project) {
    whereParts.push(`project = $${i++}`);
    params.push(filters.project);
  }

  if (filters?.query) {
    // Simple search_text ILIKE for MVP; later we can switch to full text.
    whereParts.push(`search_text ILIKE '%' || $${i++} || '%'`);
    params.push(filters.query);
  }

  const whereClause =
    whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  let orderByClause = `ORDER BY created_at DESC`;

  switch (orderBy) {
    case "created_at_asc":
      orderByClause = `ORDER BY created_at ASC`;
      break;
    case "last_viewed_desc":
      orderByClause =
        `ORDER BY last_viewed_at DESC NULLS LAST, created_at DESC`;
      break;
    case "last_viewed_asc":
      orderByClause =
        `ORDER BY last_viewed_at ASC NULLS FIRST, created_at ASC`;
      break;
  }

  // LIMIT/OFFSET
  const limitIndex = i++;
  params.push(limit);

  const offsetIndex = i++;
  params.push(offset);

  const sql = `
    SELECT
      id::text                       AS "id",
      workspace_id::text             AS "workspaceId",
      user_id::text                  AS "userId",
      artifact_id::text              AS "artifactId",
      title                          AS "title",
      kind::text                     AS "kind",
      source_type::text              AS "sourceType",
      source_id                      AS "sourceId",
      project                        AS "project",
      tags                           AS "tags",
      is_pinned                      AS "isPinned",
      pinned_at                      AS "pinnedAt",
      last_viewed_at                 AS "lastViewedAt",
      created_at                     AS "createdAt",
      updated_at                     AS "updatedAt",
      search_text                    AS "searchText"
    FROM library_items
    ${whereClause}
    ${orderByClause}
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex};
  `;

  return { sql, params };
}

/**
 * Postgres-backed LibraryStore implementation.
 * The caller is responsible for providing a db client with a compatible query interface.
 */
export const createPostgresLibraryStore: CreateLibraryStore = (deps) => {
  const client = deps.db as Queryable;

  return {
    async list(query) {
      const { sql, params } = buildListQuery(query);
      const result = await client.query<LibraryItemRow>(sql, params);
      const rows = result.rows ?? [];
      return rows.map(rowToSummary);
    },

    async getById(workspaceId, id) {
      const sql = `
        SELECT
          id::text                       AS "id",
          workspace_id::text             AS "workspaceId",
          user_id::text                  AS "userId",
          artifact_id::text              AS "artifactId",
          title                          AS "title",
          kind::text                     AS "kind",
          source_type::text              AS "sourceType",
          source_id                      AS "sourceId",
          project                        AS "project",
          tags                           AS "tags",
          is_pinned                      AS "isPinned",
          pinned_at                      AS "pinnedAt",
          last_viewed_at                 AS "lastViewedAt",
          created_at                     AS "createdAt",
          updated_at                     AS "updatedAt",
          search_text                    AS "searchText"
        FROM library_items
        WHERE workspace_id = $1 AND id = $2
        LIMIT 1;
      `;

      const result = await client.query<LibraryItemRow>(sql, [workspaceId, id]);
      const row = result.rows?.[0];
      return row ? rowToSummary(row) : null;
    },
  };
};
