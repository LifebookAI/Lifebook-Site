#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

(async () => {
  try {
    const migrationArg = process.argv[2];
    if (!migrationArg) {
      console.error("Usage: node run-sql-migration.cjs <migration-path.sql>");
      process.exit(1);
    }

    const migrationPath = path.resolve(process.cwd(), migrationArg);
    if (!fs.existsSync(migrationPath)) {
      console.error("Migration file not found:", migrationPath);
      process.exit(1);
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error("DATABASE_URL is not set.");
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, "utf8");

    const client = new Client({ connectionString });
    await client.connect();
    await client.query(sql);
    await client.end();

    console.log("Migration applied successfully:", path.basename(migrationPath));
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  }
})();
