Phase | Step ID | Step Title | Status (☐/⏳/✔/⛔) | Evidence (IDs/ARNs/links) | Decisions | Blockers | Next actions (max 3) | Owner | Target (YYYY-MM-DD)
--- | --- | --- | --- | --- | --- | --- | --- | --- | ---
Phase 0 — Infra | OPS.00 | Progress infra | ✔ | progress.ps1 reset clean; guard auto-syncs MD |  |  |  | Zach | 
Phase 0 — Lifebook-Site | REP.31 | Protect-branches enforcer | ⏳ | WF id 200496210; PR #31 open |  |  | Merge PR #31 \| Dispatch enforcer + verify release/* \| Add contributor guide & collaborator reviews | Zach | 
Phase 0 — Infra | EVT.05 | EB→SNS KMS role+grant | ✔ | Role arn:aws:iam::354630286254:role/lifebook-eb-to-sns; topic policy allow-eb-role-publish-lifebook-eb-to-sns; KMS grant on 0586aab9… with EC=topicArn; DLQ removed; matched=2 invoked=2 failed=0 |  |  |  | Zach | 
Phase 0 — Infra | EVT.10 | Eventing/alerts baseline green | ✔ | EB rules lifebook-ssm-rc-fail/sm-fail enabled; SNS arn:aws:sns:us-east-1:354630286254:lifebook-alerts; KMS key arn:aws:kms:us-east-1:354630286254:key/0586aab9-60ae-4931-b8dd-e0da232f6b1e; CW alarms wired; founder@uselifebook.ai subscribed |  |  |  | Zach | 
Phase 0 — Infra | EVT.11 | Eventing IaC + alarms follow-ups | ⏳ |  |  |  | Codify EB target role+grant+SNS policy \| Add AWS/Events FailedInvocations alarm \| Nightly synthetic ALARM→OK smoke | Zach | 
Phase 0 | AUTH.SSO.01 | Admin SSO lifebook-admin validated; dev pending | ⏳ |  |  |  | aws configure sso + sso login \| Doc profile switch in /ops/README \| — | Zach | 
Phase 0 | LEG.00 | AUP / 0.7, 0.11 | ⏳ |  |  |  | Draft AUP \| Set review window \| Track in gates-status.json | Zach | 2025-10-31
Phase 0 — Infra | NET.10 | Endpoints + routing applied | ✔ | S3 vpce-0a35ebea30f84a18b; DDB vpce-08c4ee079043266a1; RTB rtb-00a137769be488048; scripts scaffolded |  |  |  | Zach | 
Phase 0 — Infra | NET.20 | Bastion follow-ups | ⏳ |  |  |  | Add stop/start schedule \| Restrict SG egress to endpoints \| Tag/capture in IaC | Zach | 
Phase 0 — Infra | EDGE.00 | CloudFront behaviors + OAC on S3 origin | ✔ | Origin lifebook.ai.s3.us-east-1.amazonaws.com via OAC; no viewer headers; default root index.html; ViaService decrypts |  |  |  | Zach | 
Phase 0 — Infra | EDGE.01 | Edge follow-ups | ⏳ |  |  |  | Verify Host not forwarded \| Confirm ViaService decrypts in CloudTrail \| Keep OAC in IaC + /sources/* invalidations | Zach | 
Phase 0 — Infra | OPS.10 | Paste-only workflow + heartbeat verifier | ✔ | infra/ops/heartbeat/verify-heartbeat.ps1; no stored secrets; idempotent flags |  |  |  | Zach | 
Phase 0 — Infra | OPS.11 | Ops follow-ups | ⏳ |  |  |  | Set paste-run conventions \| Schedule periodic audits \| Add one-click verify | Zach | 
Phase 0 — Synthetics | MON.00 | lifebook-cf-health canary healthy | ✔ | rate(5m), syn-nodejs-puppeteer-11.0; SuccessPercent & LatencyHigh OK; LG retention 30d; artifacts in s3://lifebook-synthetics-… |  |  |  | Zach | 
Phase 0 — Synthetics | MON.01 | Synthetics follow-ups | ⏳ |  |  |  | Wire canary alarms→SNS alerts \| Add more health endpoints \| Nightly ALARM→OK smoke | Zach | 
Phase 0 — S3 Artifacts | STG.ART.01 | Synthetics bucket hardened | ✔ | SSE-KMS default; PAB all true; new artifacts use key 0586aab9-… |  |  |  | Zach | 
Phase 0 — S3 Artifacts | STG.ART.02 | Artifacts follow-ups | ⏳ |  |  |  | Consider BucketKeyEnabled \| Tag bucket + record in IaC \| Add prefix-scoped conditions | Zach | 
Phase 0 — Infra | KMS.00 | alias/lifebook-synthetics in use | ✔ | Key arn …0586aab9… used by SNS alerts + synthetics artifacts |  |  |  | Zach | 
Phase 0 — Infra | KMS.ROT.01 | Enable key rotation | ⏳ |  |  |  | Rotate alias/lifebook-synthetics \| Rotate alias/lifebook-s3-prod \| Verify alerts topic key + rotation | Zach | 
Phase 0 — Infra | IAM.00 | Canary role updated | ✔ | AWSLambdaBasicExecutionRole; CloudWatchSyntheticsFullAccess; inline metrics+KMS; trust: lambda + synthetics |  |  |  | Zach | 
Phase 0 — Infra | IAM.03 | Tighten S3 policy prefixes | ⏳ |  |  |  | Tighten to exact prefixes \| Commit policy docs \| Set annual review reminder | Zach | 
Phase 0 — Lifebook-Site | SITE.CI.01 | CI/Security hardening landed | ✔ | ci.yml, CodeQL, Dependabot, SECURITY.md, PR template, EOL guard; SSH signing; main protections with exact checks |  |  |  | Zach | 
Phase 0 — Infra | PREF.01 | Preflight fixed and clean | ✔ | scripts/Preflight.ps1 -AllJson; strict-mode split; LF-only normalized |  |  |  | Zach | 
Phase 0 — Infra | PREF.02 | Preflight follow-ups | ⏳ |  |  |  | Add CI/pre-push Preflight gate \| Hook smoke tests \| Doc paste-run conventions | Zach | 
Phase 0 — Prod S3 Data | STG.PROD.01 | Prod buckets locked (Green) | ✔ | TLS-only; VPCE-only (vpce-0a35ebee30f84a18b); PutObject requires key 58765bb9-…; ViaService+EC; inside-VPC allowed/outside denied |  |  |  | Zach | 
Phase 0 — Prod S3 Data | STG.PROD.02 | Prod S3 follow-ups | ⏳ |  |  |  | IaC bucket/VPCE/KMS \| Enable S3 logs + Config rules \| Change alarms + KMS rotation | Zach | 
Phase D.S2 — Catalog prefixes | LFC.DS2 | Catalog lifecycle | ⏳ | /ops/s3-lifecycle-catalog.json present |  |  | Apply lifecycle to prod \| Verify transitions \| Surface 'Restoring <5m' badge | Zach | 
Phase 3 — 13A | OIDC.01 | GitHub OIDC secretless deploys | ✔ | Trust scoped to repo/env; session TTL ≤1h |  |  |  | Zach | 
Phase 3 — 13A | OIDC.02 | Wire OIDC in workflow + docs | ⏳ |  |  |  | Hook GH workflow to assume role \| Document in README \| — | Zach | 
