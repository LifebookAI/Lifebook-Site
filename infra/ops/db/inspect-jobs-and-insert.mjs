import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

function getDatabaseUrl(repoRoot) {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    console.log("[INFO] Using DATABASE_URL from environment.");
    return process.env.DATABASE_URL.trim();
  }

  const envLocalPath = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(envLocalPath)) {
    throw new Error(
      "No DATABASE_URL in environment and .env.local not found at " + envLocalPath,
    );
  }

  const envText = fs.readFileSync(envLocalPath, "utf8");
  const match = envText.match(/^\\s*DATABASE_URL\\s*=\\s*(.+)\\s*$/m);
  if (!match) {
    throw new Error("DATABASE_URL not found in .env.local");
  }

  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value;
}

async function main() {
  const repoRoot = process.cwd();
  console.log("[INFO] Repo root (Node): " + repoRoot);

  const databaseUrl = getDatabaseUrl(repoRoot);
  console.log("[INFO] Connecting to Postgres with DATABASE_URL.");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    console.log("[STEP] jobs column definitions:");
    const colsRes = await client.query(
      `
      SELECT
        column_name,
        is_nullable,
        data_type,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'jobs'
      ORDER BY ordinal_position;
      `,
    );

    for (const row of colsRes.rows) {
      console.log(
        `  ${row.column_name} | nullable=${row.is_nullable} | type=${row.data_type} | default=${row.column_default}`,
      );
    }

    console.log("\\n[STEP] Attempting Library-style INSERT into jobs...");
    const runId = `run_debug_${Date.now()}`;
    const libraryItemId = "workflow.hello-library";

    try {
      await client.query(
        `
          INSERT INTO jobs (run_id, library_item_id, status, created_at)
          VALUES ($1, $2, $3, NOW());
        `,
        [runId, libraryItemId, "queued"],
      );
      console.log("[OK] INSERT succeeded with runId = " + runId);
    } catch (err) {
      console.error("[ERROR] INSERT failed for test run:", err);
    }

    console.log("\\n[STEP] Selecting last 5 jobs (run_id, library_item_id, status, created_at)...");
    const selectRes = await client.query(
      "SELECT run_id, library_item_id, status, created_at FROM jobs ORDER BY created_at DESC LIMIT 5;",
    );
    for (const row of selectRes.rows) {
      console.log(
        String(row.run_id) +
          " | " +
          String(row.library_item_id) +
          " | " +
          String(row.status) +
          " | " +
          String(row.created_at),
      );
    }
  } finally {
    await client.end();
  }

  console.log("\\n[OK] jobs inspection + test insert completed.");
}

main().catch((err) => {
  console.error("[FATAL] inspect-jobs-and-insert failed:", err);
  process.exit(1);
});

