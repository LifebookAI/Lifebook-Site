Phase | Step ID | Step Title | Status (☐/⏳/✔/⛔) | Evidence (IDs/ARNs/links) | Decisions | Blockers | Next actions (max 3) | Owner | Target (YYYY-MM-DD)
--- | --- | --- | --- | --- | --- | --- | --- | --- | ---
Phase 0 — Lifebook-Site | REP.31 | Protect-branches enforcer | ⏳ | WF id 200496210; PR #31 open |  |  | Merge PR #31 \| Dispatch enforcer + verify release/* \| Add contributor guide & collaborator reviews | Zach | 
Phase 0 — Infra | EVT.11 | Eventing IaC + alarms follow-ups | ✔ | acct=354630286254; region=us-east-1; KMS-rotation=ON; EB(lifebook-cw-alarm-smoke-nightly)=ENABLED cron(15 9 * * ? *); SNS AllowEventBridge ArnEquals empty?=NO |  |  |  | Zach | 
Phase 0 | AUTH.SSO.01 | Admin SSO lifebook-admin validated; dev pending | ⏳ |  |  |  | aws configure sso + sso login \| Doc profile switch in /ops/README \| — | Zach | 
Phase 0 | LEG.00 | AUP / 0.7, 0.11 | ⏳ |  |  |  | Draft AUP \| Set review window \| Track in gates-status.json | Zach | 2025-10-31
Phase 0 — Infra | NET.20 | Bastion follow-ups | ⏳ |  |  |  | Add stop/start schedule \| Restrict SG egress to endpoints \| Tag/capture in IaC | Zach | 
Phase 0 — Infra | EDGE.01 | Edge follow-ups | ⏳ |  |  |  | Verify Host not forwarded \| Confirm ViaService decrypts in CloudTrail \| Keep OAC in IaC + /sources/* invalidations | Zach | 
Phase 0 — Infra | OPS.11 | Ops follow-ups | ⏳ |  |  |  | Set paste-run conventions \| Schedule periodic audits \| Add one-click verify | Zach | 
Phase 0 — Synthetics | MON.01 | Synthetics follow-ups | ⏳ |  |  |  | Wire canary alarms→SNS alerts \| Add more health endpoints \| Nightly ALARM→OK smoke | Zach | 
Phase 0 — S3 Artifacts | STG.ART.02 | Artifacts follow-ups | ⏳ |  |  |  | Consider BucketKeyEnabled \| Tag bucket + record in IaC \| Add prefix-scoped conditions | Zach | 
Phase 0 — Infra | KMS.ROT.01 | Enable key rotation | ⏳ |  |  |  | Rotate alias/lifebook-synthetics \| Rotate alias/lifebook-s3-prod \| Verify alerts topic key + rotation | Zach | 
Phase 0 — Infra | IAM.03 | Tighten S3 policy prefixes | ⏳ |  |  |  | Tighten to exact prefixes \| Commit policy docs \| Set annual review reminder | Zach | 
Phase 0 — Infra | PREF.02 | Preflight follow-ups | ⏳ |  |  |  | Add CI/pre-push Preflight gate \| Hook smoke tests \| Doc paste-run conventions | Zach | 
Phase 0 — Prod S3 Data | STG.PROD.02 | Prod S3 follow-ups | ⏳ |  |  |  | IaC bucket/VPCE/KMS \| Enable S3 logs + Config rules \| Change alarms + KMS rotation | Zach | 
Phase D.S2 — Catalog prefixes | LFC.DS2 | Catalog lifecycle | ⏳ | /ops/s3-lifecycle-catalog.json present |  |  | Apply lifecycle to prod \| Verify transitions \| Surface 'Restoring <5m' badge | Zach | 
Phase 3 — 13A | OIDC.02 | Wire OIDC in workflow + docs | ⏳ |  |  |  | Hook GH workflow to assume role \| Document in README \| — | Zach | 
