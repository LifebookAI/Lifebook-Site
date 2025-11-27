#!/usr/bin/env node

const { Client } = require("pg");

(async () => {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error("DATABASE_URL is not set.");
      process.exit(1);
    }

    const trackSlug = process.argv[2] || "aws-foundations-j1";
    const labSlug   = process.argv[3] || "lab-01-local-env";

    const client = new Client({ connectionString });
    await client.connect();

    // Insert a simple job row (let defaults handle timestamps/status/etc.)
    const jobRes = await client.query(
      `INSERT INTO jobs (kind, track_slug, lab_slug, trigger_type, payload)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ["lab_materialization", trackSlug, labSlug, "manual", {}]
    );
    const jobId = jobRes.rows[0]?.id;
    if (!jobId) {
      throw new Error("Job insert did not return an id");
    }

    // Insert a corresponding lab_session pointing at that job
    const sessionRes = await client.query(
      `INSERT INTO lab_sessions (job_id, track_slug, lab_slug, title)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [jobId, trackSlug, labSlug, "J1 Local Dev Smoke Session"]
    );
    const sessionId = sessionRes.rows[0]?.id;
    if (!sessionId) {
      throw new Error("Lab session insert did not return an id");
    }

    await client.end();

    console.log("Inserted job id:", jobId);
    console.log("Inserted lab_session id:", sessionId);
    console.log("Seed OK for track:", trackSlug, "lab:", labSlug);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  }
})();
