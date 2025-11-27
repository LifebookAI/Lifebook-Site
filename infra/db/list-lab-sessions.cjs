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
      `SELECT id, track_slug, lab_slug, title, status, created_at
       FROM lab_sessions
       ORDER BY created_at DESC
       LIMIT 10`
    );

    await client.end();

    if (!res.rows.length) {
      console.log("No lab_sessions rows found.");
      process.exit(0);
    }

    console.log("Latest lab_sessions:");
    for (const row of res.rows) {
      console.log(
        "-",
        row.id,
        "| track:", row.track_slug,
        "| lab:", row.lab_slug,
        "| status:", row.status,
        "| created_at:", row.created_at
      );
    }
  } catch (err) {
    console.error("List failed:", err.message);
    process.exit(1);
  }
})();
