Phase | Step ID | Step Title | Status (☐/⏳/✔/⛔) | Evidence (IDs/ARNs/links) | Decisions | Blockers | Next actions (max 3) | Owner | Target (YYYY-MM-DD)
--- | --- | --- | --- | --- | --- | --- | --- | --- | ---
Phase 0 — Infra | NET.20 | Bastion follow-ups | ⏳ | NET.20 verify → scheduler-role-missing, no-bastion |  |  | Tag instance(s) Component=bastion; re-run NET.20 apply | Zach |
Phase 0 — Infra | P1.S1 |  | ✔ | PR #55 merged; workflows (dependabot-nightly.yml, codeql.yml) on main; branch protection requires CodeQL; Dependabot=0; checkpoint build-checkpoints.json |  |  |  | Zach |
- 2025-11-04T17:54:53-05:00 — Zero-actions CI on **main**: run **19085307598**; verified **s3://lifebook.ai/synthetic/rawpwsh_19085307598.txt**.
- 2025-11-04T17:57:23-05:00 — Zero-actions CI on **main**: run **19085359956**; verified **s3://lifebook.ai/synthetic/rawpwsh_19085359956.txt**.
- 2025-11-04T18:01:59-05:00 — Zero-actions CI on **main**: run **19085458741**; verified **s3://lifebook.ai/synthetic/rawpwsh_19085458741.txt**.
- 2025-11-04T18:09:22-05:00 — Zero-actions CI on **main**: run **19085627216**; verified **s3://lifebook.ai/synthetic/rawpwsh_19085627216.txt**.
- 2025-11-04T18:16:22-05:00 — Zero-actions CI on **main**: run **19085788940**; verified **s3://lifebook.ai/synthetic/rawpwsh_19085788940.txt**.
- 2025-11-04T19:38:47-05:00 — EVT.11 green: OIDC trust OK; VPCE Deny carved out via NotResource=synthetic/*; KMS via S3 OK; run **19085788940** wrote **s3://lifebook.ai/synthetic/rawpwsh_19085788940.txt** (ETag "3069cd1b6b16bdd58535d0d94d84185a").
- 2025-11-04T19:40:42-05:00 — EVT.11 green: OIDC trust OK; VPCE Deny carved out via NotResource=synthetic/*; KMS via S3 OK; run **19085788940** wrote **s3://lifebook.ai/synthetic/rawpwsh_19085788940.txt** (ETag "3069cd1b6b16bdd58535d0d94d84185a").
- 2025-11-04T20:16:48-05:00 — Repo guardrails set (pull.rebase, autoStash, rerere, zdiff3, safecrlf, autocrlf=false); added **scripts/recover-rebase.ps1** (continue/abort + swap cleanup).
- 2025-11-04T20:26:27-05:00 — EOL locked: repo renormalized to LF under .gitattributes + .editorconfig.
- 2025-11-04T20:29:41-05:00 — Pre-commit hardening: pretty-format-json (build-progress) + forbid-CR hook; repo verified clean.
- 2025-11-04T20:32:25-05:00 — Pre-commit local hooks added: pretty-build-progress-json + forbid-cr; LF/UTF-8 enforced.
- 2025-11-04T20:49:22-05:00 — Pre-commit hardened (valid YAML + local hooks); repo LF-only; CR scans clean.
- 2025-11-04T20:53:44-05:00 — Branch protection enforced on main (checks: pre-commit, CodeQL, EOL guard; PR review=1; linear history; admins enforced; signatures attempted).
- 2025-11-04T20:56:41-05:00 — Branch protection tightened (checks: pre-commit, CodeQL, EOL guard; conv. resolution ON; admins enforced; linear history; signatures attempted).
- 2025-11-04T21:00:43-05:00 — Guard aligned: contexts=[pre-commit, CodeQL, EOL guard (LF only)]; protection verified; retriggered guard.
- 2025-11-04T21:06:12-05:00 — Guard audit workflow installed (expects ⊇ [pre-commit, CodeQL, EOL guard (LF only)] + admins/linear/conv-res/signatures); dispatched run.
- 2025-11-05T00:11:39-05:00 — PR #68 guard flow: checks green → temp reviews=0 (if needed) → merged → restore reviews=1 → cleanup branch.
- 2025-11-05T00:15:32-05:00 — PR #68 merged; local cleaned; auto-delete on; protections verified.
