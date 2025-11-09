# Analytics Spec (authoritative) — MVP v1

**Source of truth.** CI blocks any client/server event not listed here.
Conventions: `snake_case` event names; required props **bold**; UUIDv4 ids; no PII; server timestamps when possible.

## Events (MVP v1)

1. source_connected — **workspace_id**, **user_id**, source_type, provider, success, error_code(opt)
2. workflow_run_started — **job_id**, **workspace_id**, **user_id**, trigger_type, template_id(opt), plan_tier, idempotency_key(opt), credits_estimate, concurrency_slot
3. workflow_run_reserved_credits — **job_id**, **credits_reserved**, estimator_variance_pct, steps_breakdown(json)
4. workflow_run_completed — **job_id**, **credits_spent**, **duration_ms**, **success**, gm_estimate_pct, artifact_count, error_code(opt)
5. artifact_saved — **artifact_id**, **job_id**, **workspace_id**, type, format, sha256, bytes
6. notion_export — **artifact_id**, **page_id**, success, error_code(opt)
7. capture_created — **workspace_id**, **user_id**, capture_type(screen|audio), bytes, duration_ms
8. study_track_started — **workspace_id**, **user_id**, track_id
9. study_step_completed — **workspace_id**, **user_id**, track_id, step_id, success
10. checkout_completed — **workspace_id**, plan_tier, price_usd, interval, credits_granted
11. credit_pack_purchased — **workspace_id**, pack_id, credits
12. schedule_created — **workspace_id**, workflow_id, cron, next_fire_at
13. schedule_triggered — **workspace_id**, workflow_id, job_id
14. library_search_performed — **workspace_id**, query_len, has_filters, results_count
15. library_item_viewed — **workspace_id**, item_id, dwell_ms
16. weekly_digest_sent — **workspace_id**, artifact_count, runs_count
17. billing_limit_hit — **workspace_id**, threshold(70|90|100), meter(storage|credits), action(block|warn)
18. storage_threshold_crossed — **workspace_id**, threshold_percent
19. reactivation_nudge_sent — **workspace_id**, last_active_days

### Machine-readable allowlist
<!-- BEGIN:EVENT_ALLOWLIST_JSON -->
{
  "events": [
    "source_connected",
    "workflow_run_started",
    "workflow_run_reserved_credits",
    "workflow_run_completed",
    "artifact_saved",
    "notion_export",
    "capture_created",
    "study_track_started",
    "study_step_completed",
    "checkout_completed",
    "credit_pack_purchased",
    "schedule_created",
    "schedule_triggered",
    "library_search_performed",
    "library_item_viewed",
    "weekly_digest_sent",
    "billing_limit_hit",
    "storage_threshold_crossed",
    "reactivation_nudge_sent"
  ]
}
<!-- END:EVENT_ALLOWLIST_JSON -->

**CI Guard:** See `infra/ci/Validate-AnalyticsSpec.ps1`. Any event used in code that is not listed above will fail the PR check.

**Notes:**

- Activation (A1) comes from `source_connected`, `workflow_run_started/completed`, and `artifact_saved`.

- Privacy: No raw content in analytics; only ids/counters; sampling allowed.
