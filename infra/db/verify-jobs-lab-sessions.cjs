#!/usr/bin/env node

const { Client } = require("pg");

(async () => {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error("DATABASE_URL is not set.");
      process.exit(1);
    }

    const client = new Client({ connectionString });
    await client.connect();

    const res = await client.query(
      "SELECT to_regclass('public.jobs') AS jobs_table, to_regclass('public.lab_sessions') AS lab_sessions_table"
    );

    await client.end();

    const row = res.rows[0] || {};
    console.log("jobs_table:", row.jobs_table);
    console.log("lab_sessions_table:", row.lab_sessions_table);

    if (!row.jobs_table || !row.lab_sessions_table) {
      console.error("One or both tables are missing.");
      process.exit(1);
    }

    console.log("Verification OK: jobs and lab_sessions tables exist.");
  } catch (err) {
    console.error("Verification failed:", err.message);
    process.exit(1);
  }
})();
