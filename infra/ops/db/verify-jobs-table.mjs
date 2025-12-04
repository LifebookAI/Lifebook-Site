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
  const match = envText.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
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

async function ensureJobsShape(client) {
  console.log("[STEP] Inspecting jobs table schema (if any)...");
  const res = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'jobs';",
  );

  if (res.rows.length === 0) {
    console.log("[INFO] jobs table does not exist yet; migration will create it.");
    return;
  }

  const cols = res.rows.map((r) => String(r.column_name));
  console.log("[INFO] Existing jobs columns: " + cols.join(", "));

  const alters = [];

  if (!cols.includes("run_id")) {
    alters.push("ALTER TABLE jobs ADD COLUMN run_id text;");
  }
  if (!cols.includes("library_item_id")) {
    alters.push("ALTER TABLE jobs ADD COLUMN library_item_id text;");
  }
  if (!cols.includes("status")) {
    alters.push(
      "ALTER TABLE jobs ADD COLUMN status text NOT NULL DEFAULT 'pending';",
    );
  }
  if (!cols.includes("created_at")) {
    alters.push(
      "ALTER TABLE jobs ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();",
    );
  }

  for (const sql of alters) {
    console.log("[STEP] " + sql);
    await client.query(sql);
  }

  if (alters.length === 0) {
    console.log("[INFO] jobs table already has expected columns.");
  }
}

async function main() {
  const repoRoot = process.cwd();
  console.log("[INFO] Repo root (Node): " + repoRoot);

  const migrationPath = path.join(
    repoRoot,
    "db",
    "migrations",
    "20251108_library.sql",
  );
  if (!fs.existsSync(migrationPath)) {
    throw new Error("Migration file not found at " + migrationPath);
  }

  const databaseUrl = getDatabaseUrl(repoRoot);
  console.log("[INFO] Connecting to Postgres with DATABASE_URL.");

  const client = new Client({
    connectionString: databaseUrl,
  });

  await client.connect();

  try {
    // 1) Ensure jobs table has the columns our migration/index expects
    await ensureJobsShape(client);

    // 2) Apply migration (idempotent CREATE TABLE/INDEX)
    console.log("[STEP] Applying migration 20251108_library.sql...");
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    await client.query(migrationSql);
    console.log("[OK] Migration applied successfully (or already applied).");

    // 3) Show last few jobs
    console.log("\\n[STEP] Selecting last 5 jobs...");
    const res = await client.query(
      "SELECT run_id, library_item_id, status, created_at FROM jobs ORDER BY created_at DESC LIMIT 5;",
    );

    if (!res.rows || res.rows.length === 0) {
      console.log(
        "[INFO] jobs table is empty. Trigger a Library run and re-run to see rows.",
      );
    } else {
      for (const row of res.rows) {
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
    }
  } finally {
    await client.end();
  }

  console.log("\\n[OK] jobs table exists and query completed.");
}

main().catch((err) => {
  console.error("[ERROR] verify-jobs-table failed:", err);
  process.exit(1);
});
