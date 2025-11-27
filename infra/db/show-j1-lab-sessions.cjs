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
      `SELECT
         j.id          AS job_id,
         j.kind        AS job_kind,
         j.status      AS job_status,
         j.track_slug  AS job_track,
         j.lab_slug    AS job_lab,
         j.created_at  AS job_created_at,
         l.id          AS session_id,
         l.title       AS session_title,
         l.status      AS session_status,
         l.created_at  AS session_created_at
       FROM lab_sessions l
       JOIN jobs j ON j.id = l.job_id
       ORDER BY l.created_at DESC
       LIMIT 10`
    );

    await client.end();

    if (!res.rows.length) {
      console.log("No joined jobs/lab_sessions rows found.");
      process.exit(0);
    }

    console.log("Latest jobs + lab_sessions (joined):");
    for (const row of res.rows) {
      console.log(
        "- job:", row.job_id,
        "| kind:", row.job_kind,
        "| status:", row.job_status,
        "| track:", row.job_track,
        "| lab:", row.job_lab,
        "| session:", row.session_id,
        "| session_title:", row.session_title,
        "| session_status:", row.session_status,
        "| created_at:", row.session_created_at
      );
    }
  } catch (err) {
    console.error("Join viewer failed:", err.message);
    process.exit(1);
  }
})();
