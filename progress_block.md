Phase | Step ID | Step Title | Status (☐/⏳/✔/⛔) | Evidence (IDs/ARNs/links) | Decisions | Blockers | Next actions (max 3) | Owner | Target (YYYY-MM-DD)
--- | --- | --- | --- | --- | --- | --- | --- | --- | ---
Phase 0 — Infra | orchestrator_worker_ddb_adapter |  | ✔ | Updated orchestrator job-store adapter to support pk/sk, job_id, and jobId key shapes; Fixed updateJobStatus to use discovered key shape + correct UpdateExpression (status, updated_at, attempts, payload, error fields); Smoke script now parses job_id from output, scans DDB, and… |  |  |  | Zach | 
Phase 0 — Infra | 18A_orchestrator_worker_idempotency |  | ✔ | job-status.ts + status/concurrency harness + orchestrator E2E smoke green; second-worker races modeled as idempotent noise. |  |  |  | Zach | 
