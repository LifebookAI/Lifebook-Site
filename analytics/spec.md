# Analytics Spec — FD-1 (authoritative)

Conventions: snake_case; **bold** = required; UUIDv4 ids; no PII; server timestamps when possible.

Core events (MVP / A1):
1) source_connected — **workspace_id**, **user_id**, source_type, provider, success, error_code(opt)
2) workflow_run_started — **job_id**, **workspace_id**, **user_id**, trigger_type, template_id(opt), plan_tier, idempotency_key(opt), credits_estimate, concurrency_slot
3) workflow_run_completed — **job_id**, **credits_spent**, **duration_ms**, **success**, gm_estimate_pct, artifact_count, error_code(opt)
4) artifact_saved — **artifact_id**, **job_id**, **workspace_id**, type, format, sha256, bytes
5) notion_export — **artifact_id**, **page_id**, success, error_code(opt)
6) schedule_created — **workspace_id**, workflow_id, cron, next_fire_at
7) schedule_triggered — **workspace_id**, workflow_id, **job_id**
8) library_search_performed — **workspace_id**, query_len, has_filters, results_count
9) billing_limit_hit — **workspace_id**, threshold(70|90|100), meter(storage|credits), action(block|warn)

CI guard: Only the above event names are allowed. Unknown => fail.