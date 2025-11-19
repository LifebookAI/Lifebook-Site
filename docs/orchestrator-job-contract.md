# Orchestrator Job Contract (lifebook-orchestrator-jobs v1)

This document defines the v1 contract for orchestrated workflow runs handled by:

- SQS queue: lifebook-orchestrator-queue
- Lambda:    lifebook-orchestrator-worker
- Job store: DynamoDB table lifebook-orchestrator-jobs

## Table

- Table name: lifebook-orchestrator-jobs
- Region:     us-east-1
- Billing:    PAY_PER_REQUEST (on-demand)
- Partition key (PK): job_id (string, UUIDv4)
- Global Secondary Index: workspace_created_at
  - GSI PK: workspace_id (string)
  - GSI SK: created_at (ISO-8601 string)
  - Projection: status, workflow_id, trigger_type, credits_estimate

TTL attribute: ttl_at (Unix epoch seconds). Terminal jobs (completed, dead, canceled) should set ttl_at according to the retention window in FD-10 Storage & Retention Matrix.

## Item shape (v1 floor)

Core fields (all strings unless noted):

- job_id          : UUIDv4, primary identifier, shared with analytics events
- workspace_id    : workspace that owns the run
- user_id         : initiating user
- workflow_id     : workflow/template id
- trigger_type    : manual | schedule | webhook | file_drop
- status          : pending | queued | running | completed | failed | dead | canceled
- attempts        : number (int), how many times we have attempted to run
- max_attempts    : number (int), default 5
- step_cursor     : number (int), index of the next step to execute (0-based)
- steps_total     : number (int), total steps in the workflow at job creation
- credits_estimate: number, estimated credits for the run
- credits_reserved: number, reserved credits (see FD-2)
- credits_spent   : number, actual spent credits so far
- idempotency_key : string used to dedupe logical runs
- last_error_code    : short, non-PII error code
- last_error_message : short, non-PII message for debugging
- created_at      : ISO-8601 timestamp when job created
- updated_at      : ISO-8601 timestamp when last mutated
- started_at      : ISO-8601 timestamp when first picked up
- completed_at    : ISO-8601 timestamp on terminal success/failure
- ttl_at          : Unix epoch seconds for TTL expiry

Large payloads (files, transcripts, artifacts) live in S3 or other stores; the job record only keeps references.

## Status model

- pending   : record created, not yet enqueued to SQS
- queued    : SQS message exists or is in-flight
- running   : worker has locked this job and is executing
- completed : success, artifacts saved, analytics success emitted
- failed    : latest attempt failed; may be retried while attempts < max_attempts
- dead      : permanent failure (max attempts hit or poison job); SQS message in DLQ
- canceled  : explicitly canceled by user or system; worker should no-op

Invalid transitions are rejected by the worker and logged.

## SQS payload (v1 shape)

The message body is a thin envelope; the job record holds the full state.

Fields:

- v               : payload version (1)
- job_id          : matches DynamoDB job_id
- workspace_id    : matches workspace_id
- trigger_type    : manual | schedule | webhook | file_drop
- attempt         : 1-based attempt number for this message
- max_attempts    : copy of max_attempts
- trace_id        : trace identifier for logs/metrics
- idempotency_key : copy of job idempotency key

Message attributes may be extended later (e.g., priority) but the body is canonical.

## Retry, backoff, DLQ

Queue-level configuration (Terraform):

- RedrivePolicy.maxReceiveCount: 5 (v1 default)
- Visibility timeout: large enough for a typical job (tuned later)

Worker behavior:

1. On failure, increments attempts and sets status = failed, with last_error_code/message.
2. If attempts < max_attempts, rely on SQS redelivery.
3. If attempts >= max_attempts, mark status = dead, set completed_at, and emit workflow_run_completed with success=false.

Once maxReceiveCount is exceeded, SQS moves the message into the DLQ. DLQ depth is monitored via lifebook-orchestrator-dlq-depth and alarms to lifebook-alerts.

## Backoff policy (v1 suggested)

- Attempt 1: ~30 seconds
- Attempt 2: ~120 seconds
- Attempt 3: ~600 seconds
- Attempt >=4: cap around 1800 seconds (30 minutes)

Backoff is implemented via visibility timeout and/or next_attempt_at in the job record.

## Idempotency and resume

- API creates jobs with an idempotency_key and conditional write to avoid duplicates.
- Worker reads the job record; if status is terminal (completed, dead, canceled), it treats the message as an idempotent no-op.
- step_cursor and steps_total are used to resume safely:
  - After each successful step, worker increments step_cursor and updates updated_at.
  - On success for all steps, sets status = completed and completed_at.

Retries therefore re-use the same job record, skipping any already-completed steps.

## Retention

- When job reaches a terminal state, set ttl_at = now + retention_window.
- Retention window is defined in FD-10. TTL ensures the jobs table does not grow without bound while preserving enough history for dashboards and debugging.

This contract is v1 and authoritative for orchestrator, API, and analytics until a new version is stamped and referenced in the Master Sheet.
