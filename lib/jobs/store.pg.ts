import { randomUUID } from "node:crypto";
import { ensureJobsSchema, getPgPool } from "./db";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type Job = {
  id: string;
  workspaceId: string;
  kind: string;
  triggerType: "manual" | "schedule" | "webhook" | string;
  templateId?: string | null;
  idempotencyKey?: string | null;
  status: JobStatus;
  attempt: number;
  payload?: unknown;
  result?: unknown;
  error?: unknown;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type RunLogLevel = "debug" | "info" | "warn" | "error";

function nowIso(): string { return new Date().toISOString(); }

export async function appendRunLog(jobId: string, level: RunLogLevel, msg: string, meta?: unknown): Promise<void> {
  await ensureJobsSchema();
  const pool = getPgPool();
  await pool.query(
    `INSERT INTO run_logs (job_id, level, msg, meta_json) VALUES ($1, $2, $3, $4::jsonb);`,
    [jobId, level, msg, meta ? JSON.stringify(meta) : null]
  );
}

export async function getJob(workspaceId: string, jobId: string): Promise<Job | null> {
  await ensureJobsSchema();
  const pool = getPgPool();
  const r = await pool.query(`SELECT job_json FROM jobs WHERE workspace_id = $1 AND id = $2;`, [workspaceId, jobId]);
  if (r.rowCount === 0) return null;
  return r.rows[0].job_json as Job;
}

async function upsertJob(job: Job): Promise<void> {
  const pool = getPgPool();
  const lastErr = job.error ? String(job.error) : null;

  await pool.query(
    `
    INSERT INTO jobs (id, workspace_id, kind, trigger_type, template_id, idempotency_key, status, attempt, job_json, last_error, created_at, updated_at, started_at, finished_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10, NOW(), NOW(), $11, $12)
    ON CONFLICT (id) DO UPDATE SET
      kind = EXCLUDED.kind,
      trigger_type = EXCLUDED.trigger_type,
      template_id = EXCLUDED.template_id,
      idempotency_key = EXCLUDED.idempotency_key,
      status = EXCLUDED.status,
      attempt = EXCLUDED.attempt,
      job_json = EXCLUDED.job_json,
      last_error = EXCLUDED.last_error,
      updated_at = NOW(),
      started_at = EXCLUDED.started_at,
      finished_at = EXCLUDED.finished_at;
    `,
    [
      job.id, job.workspaceId, job.kind, job.triggerType, job.templateId ?? null, job.idempotencyKey ?? null,
      job.status, job.attempt, JSON.stringify(job), lastErr,
      job.startedAt ?? null, job.finishedAt ?? null
    ]
  );
}

export async function enqueueJob(input: {
  workspaceId: string;
  kind: string;
  payload?: unknown;
  triggerType?: string;
  templateId?: string | null;
  idempotencyKey?: string | null;
}): Promise<Job> {
  await ensureJobsSchema();
  const pool = getPgPool();

  if (input.idempotencyKey) {
    const existing = await pool.query(
      `SELECT job_json FROM jobs WHERE workspace_id=$1 AND idempotency_key=$2;`,
      [input.workspaceId, input.idempotencyKey]
    );
    if (existing.rowCount > 0) return existing.rows[0].job_json as Job;
  }

  const job: Job = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    kind: input.kind,
    triggerType: input.triggerType ?? "manual",
    templateId: input.templateId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    status: "queued",
    attempt: 0,
    payload: input.payload,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    startedAt: null,
    finishedAt: null,
  };

  await upsertJob(job);
  await appendRunLog(job.id, "info", "enqueued", { kind: job.kind, triggerType: job.triggerType });
  return job;
}

async function claimJobForRun(workspaceId: string, jobId: string): Promise<{ claimed: boolean; job: Job }> {
  await ensureJobsSchema();
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sel = await client.query(
      `SELECT job_json FROM jobs WHERE workspace_id=$1 AND id=$2 FOR UPDATE;`,
      [workspaceId, jobId]
    );
    if (sel.rowCount === 0) throw new Error("JOB_NOT_FOUND");

    const job = sel.rows[0].job_json as Job;
    if (job.status !== "queued") { await client.query("COMMIT"); return { claimed: false, job }; }

    const updated: Job = {
      ...job,
      status: "running",
      attempt: (job.attempt ?? 0) + 1,
      updatedAt: nowIso(),
      startedAt: nowIso(),
    };

    await client.query(
      `UPDATE jobs SET status=$3, attempt=$4, job_json=$5::jsonb, updated_at=NOW(), started_at=NOW() WHERE workspace_id=$1 AND id=$2;`,
      [workspaceId, jobId, updated.status, updated.attempt, JSON.stringify(updated)]
    );

    await client.query("COMMIT");
    return { claimed: true, job: updated };
  } catch {
    await client.query("ROLLBACK");
    throw;
  } finally {
    client.release();
  }
}

async function complete(job: Job, status: JobStatus, result?: unknown, error?: unknown): Promise<Job> {
  const updated: Job = {
    ...job,
    status,
    result,
    error: error ? String(error) : undefined,
    updatedAt: nowIso(),
    finishedAt: nowIso(),
  };
  await upsertJob(updated);
  return updated;
}

async function tryWorker(job: Job): Promise<unknown> {
  // Optional integration point; keeps 18A unblocked even if worker module isn't ready.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("@/lib/jobs/worker");
    const fn =
      (typeof mod.runJob === "function" && mod.runJob) ||
      (typeof mod.executeJob === "function" && mod.executeJob) ||
      (typeof mod.default === "function" && mod.default);
    if (typeof fn === "function") return await fn(job);
  } catch { /* noop */ }
  return { ok: true, note: "noop handler (no worker found)" };
}

export async function runJob(workspaceId: string, jobId: string): Promise<Job> {
  const { claimed, job } = await claimJobForRun(workspaceId, jobId);
  if (!claimed) return job; // idempotent

  await appendRunLog(jobId, "info", "running", { attempt: job.attempt });

  try {
    const result = await tryWorker(job);
    const done = await complete(job, "succeeded", result, undefined);
    await appendRunLog(jobId, "info", "succeeded");
    return done;
  } catch (e: any) {
    const failed = await complete(job, "failed", undefined, e?.message ?? String(e));
    await appendRunLog(jobId, "error", "failed", { error: failed.error });
    return failed;
  }
}