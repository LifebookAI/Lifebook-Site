# Orchestrator Idempotency Spec

_Last updated: 2025-11-21_

This document describes the **expected behavior** of the orchestrator when
processing SQS messages for a given `job_id`, especially under duplicates,
retries, and concurrent workers. It is enforced by automated tests in:

- `services/orchestrator/tests/idempotency.test.js`
- Harness: `services/orchestrator/src/testing/createTestContext.js`

The goal is that **multiple deliveries or retries never corrupt job state,
double-process work, or regress a job once it is terminal**.

---

## Status model (high level)

Jobs live in a DynamoDB-backed `jobs` table (see FD-9 in the Master Sheet).
For idempotency, we care about these categories:

- **Non-terminal**: `queued`, `claimed`, `running`
- **Terminal**: `succeeded`, `failed`, `cancelled`, `dead_lettered`

Terminal jobs are considered **finished** for idempotency purposes. Any
subsequent deliveries for the same `job_id` are strict no-ops.

---

## Core guarantees

### 1. Duplicate SQS deliveries (same job_id) are safe

Given multiple deliveries of the *same logical message* (same `job_id`):

1. Processing a non-terminal job (e.g., `queued`) **must not** create
   duplicate work or regress the job back to an earlier status.
2. A second (or Nth) delivery for the same `job_id` is allowed to see:
   - an in-progress state (`claimed`, `running`), or
   - a terminal state (`succeeded`, `failed`, `cancelled`, `dead_lettered`),
   but **never** a regression to `queued`.
3. The worker returns one of the following outcomes:
   - `claimed` — this worker successfully claimed and completed the job.
   - `already-claimed` — some other worker already owns or completed the job.
   - `no-op-terminal` — the job is already terminal; nothing to do.

These rules are validated in:

- `it('re-processing the same SQS message is idempotent for a non-terminal job', ...)`

### 2. Late / out-of-order deliveries after terminal are pure no-ops

Once a job is terminal (`succeeded`, `failed`, `cancelled`, `dead_lettered`):

1. Any further SQS deliveries for that `job_id` **must not** change the row.
2. The worker must:
   - Read the current row.
   - Detect that the job is terminal.
   - Return `no-op-terminal` without attempting to re-run work, adjust
     counters, or update timestamps in a way that changes the meaning of
     the job.
3. Before and after states (for that job row) must be **byte-for-byte
   compatible** at the schema level, except for audit fields that are
   explicitly allowed to change (if any; current harness assumes none).

Validated in:

- `it('late or out-of-order deliveries are pure no-ops once the job is terminal', ...)`

### 3. Multiple workers racing on the same job_id yield a single winner

When two or more workers pick up messages for the same `job_id` at
approximately the same time:

1. Exactly **one** worker is allowed to "win" the claim:
   - The winner transitions the job from `queued` to an in-progress state
     and then to a terminal state (e.g., `succeeded`).
   - The winner sees outcome `claimed`.
2. All other workers must behave safely:
   - They observe an updated row and return `already-claimed`, or
   - If the row has already reached a terminal state, they return `no-op-terminal`.
3. The final job status **must not** remain `queued`.
4. The final status must be one of the valid post-claim statuses:
   - `claimed`, `running`, `succeeded`, `failed`, `cancelled`, `dead_lettered`.

Validated in:

- `it('multiple workers racing on the same job yield a single winner and safe losers', ...)`

---

## Implementation notes (for the real worker)

The in-memory harness in `createTestContext.js` uses:

- A `Map<job_id, job>` to emulate the `jobs` table
- A simple `version` field and `locked_by` ownership model
- A time-based simulation (`simulateWorkDelayMs`) to exercise races

The real DynamoDB-backed worker should mirror these semantics by:

1. Fetching the current job row by `job_id`.
2. Checking for terminal status early and returning `no-op-terminal` if so.
3. Using a conditional write (e.g., `ConditionExpression` on `version` or
   `locked_by`/`status`) to perform the claim; if the condition fails, treat
   the attempt as `already-claimed` and do not re-run work.
4. Only transitioning to terminal states once per job, with retries and
   DLQ behavior implemented in terms of these guarantees.

Whenever the worker logic changes, update:

- This spec file (`docs/idempotency.md`)
- The harness (`src/testing/createTestContext.js`)
- The tests (`tests/idempotency.test.js`)

so the orchestrator remains **idempotent by design** and **enforced by tests**.

---
