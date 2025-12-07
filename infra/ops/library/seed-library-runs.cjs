/* eslint-disable no-console */
/**
 * infra/ops/library/seed-library-runs.cjs
 *
 * Debug seed script for the Personal Library.
 *
 * - Connects to Postgres using process.env.DATABASE_URL
 * - Ensures library_runs / library_artifacts tables exist by applying the
 *   20251108_library.sql migration
 * - Upserts a single debug run + two artifacts for a workspace-scoped view
 *
 * This script is intended for dev/test only.
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

/**
 * Entry point.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[library seed] DATABASE_URL is not set; aborting.");
    process.exit(1);
  }

  const workspaceId =
    process.env.LIBRARY_DEBUG_WORKSPACE_ID || "debug-workspace-1";

  console.log(
    `[library seed] Using workspace_id=${workspaceId} (set LIBRARY_DEBUG_WORKSPACE_ID to override).`,
  );

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    // 1) Apply migration (idempotent)
    const migrationPath = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "db",
      "migrations",
      "20251108_library.sql",
    );

    let migrationSql = null;

    try {
      migrationSql = fs.readFileSync(migrationPath, "utf8");
    } catch (err) {
      console.warn(
        `[library seed] Could not read migration file at ${migrationPath}; assuming tables already exist.`,
      );
      console.warn("[library seed] Error:", err.message);
    }

    if (migrationSql) {
      console.log(
        `[library seed] Applying migration from ${migrationPath} (or confirming current state)...`,
      );
      await client.query(migrationSql);
      console.log("[library seed] Migration applied / confirmed.");
    }

    // 2) Seed a single debug run
    const nowIso = new Date().toISOString();
    const runId = "debug-run-1";

    console.log(
      `[library seed] Upserting library_runs row id=${runId} workspace_id=${workspaceId}...`,
    );

    await client.query(
      `
      INSERT INTO library_runs (
        id,
        workspace_id,
        label,
        status,
        started_at,
        completed_at,
        source_job_id,
        source_kind
      )
      VALUES (
        $1,
        $2,
        $3,
        'success',
        $4,
        $5,
        NULL,
        'workflow'
      )
      ON CONFLICT (id) DO UPDATE
      SET
        workspace_id = EXCLUDED.workspace_id,
        label        = EXCLUDED.label,
        status       = EXCLUDED.status,
        started_at   = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        source_kind  = EXCLUDED.source_kind,
        updated_at   = now()
      `,
      [
        runId,
        workspaceId,
        "Debug Library run seeded via infra/ops/library/seed-library-runs.cjs",
        nowIso,
        nowIso,
      ],
    );

    // 3) Seed two artifacts for that run
    const artifacts = [
      {
        id: "debug-artifact-1",
        label: "Debug transcript (seed)",
        type: "transcript",
      },
      {
        id: "debug-artifact-2",
        label: "Debug summary (seed)",
        type: "summary",
      },
    ];

    for (const art of artifacts) {
      console.log(
        `[library seed] Upserting library_artifacts row id=${art.id} run_id=${runId} type=${art.type}...`,
      );
      await client.query(
        `
        INSERT INTO library_artifacts (
          id,
          run_id,
          label,
          type,
          storage_uri,
          metadata
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          NULL,
          '{}'::jsonb
        )
        ON CONFLICT (id) DO UPDATE
        SET
          run_id    = EXCLUDED.run_id,
          label     = EXCLUDED.label,
          type      = EXCLUDED.type,
          updated_at = now()
        `,
        [art.id, runId, art.label, art.type],
      );
    }

    // 4) Show a small sample of runs for this workspace
    const { rows } = await client.query(
      `
      SELECT
        id,
        label,
        workspace_id,
        status,
        started_at,
        completed_at
      FROM library_runs
      WHERE workspace_id = $1
      ORDER BY started_at DESC
      LIMIT 5
      `,
      [workspaceId],
    );

    console.log(
      `[library seed] Seed complete for workspace_id=${workspaceId}. Sample runs:`,
    );
    console.log(rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[library seed] Unexpected error:", err);
  process.exit(1);
});