Phase | Step ID | Step Title | Status (☐/⏳/✔/⛔) | Evidence (IDs/ARNs/links) | Decisions | Blockers | Next actions (max 3) | Owner | Target (YYYY-MM-DD)
--- | --- | --- | --- | --- | --- | --- | --- | --- | ---
Phase 0 — Lifebook-Site | REP.31 | Protect-branches enforcer | ✔ | BPR id=BPR_kwDOPc61NM4EHhPz pattern=release/*; default=main prot=True; release/* protected=True |  |  |  | Zach | 
Phase 0 — Infra | EVT.11 | Eventing IaC + alarms follow-ups | ✔ | acct=354630286254; region=us-east-1; KMS-rotation=ON; EB(lifebook-cw-alarm-smoke-nightly)=ENABLED cron(15 9 * * ? *); SNS AllowEventBridge ArnEquals empty?=NO |  |  |  | Zach | 
Phase 0 | AUTH.SSO.01 | Admin SSO lifebook-admin validated; dev pending | ✔ | Profile=lifebook-dev; StartURL=https://d-906629e799.awsapps.com/start; AccountAlias=n/a; Caller=arn:aws:sts::354630286254:assumed-role/AWSReservedSSO_AdministratorAccess_218fc3a66a7afc34/Founder; STSAccount=354630286254; Region=us-east-1 |  |  |  | Zach | 
Phase 0 | LEG.00 | AUP / 0.7, 0.11 | ✔ | AUP v0.11 draft at legal/AUP.md; review=2025-10-26→2025-10-31 tracked in ops/gates-status.json |  |  |  | Zach | 
Phase 0 — Infra | NET.20 | Bastion follow-ups | ⏳ | NET.20 verify → scheduler-role-missing, no-bastion |  |  | Tag instance(s) Component=bastion; re-run NET.20 apply | Zach | 
Phase 0 — Infra | EDGE.01 | Edge follow-ups | ✔ | checked=1 dists; no Host forwarded |  |  |  | Zach | 
Phase 0 — Infra | OPS.11 | Ops follow-ups | ✔ | QuickVerify exit=0;  |  |  |  | Zach | 
Phase 0 — Synthetics | MON.01 | Synthetics follow-ups | ✔ | region=us-east-1; canaries=0; created=0; updated=0; unchanged=0; topic=arn:aws:sns:us-east-1:354630286254:lifebook-alerts |  |  |  | Zach | 
Phase 0 — S3 Artifacts | STG.ART.02 | Artifacts follow-ups | ⏳ | STG.ART.02: no artifacts buckets found by name/tag; nothing changed |  |  | Tag bucket(s) {Project=lifebook,Component=artifacts}; rerun | Zach | 
Phase 0 — Infra | KMS.ROT.01 | Enable key rotation | ✔ | region=us-east-1; alias/lifebook-synthetics=ON; alias/lifebook-s3-prod=ON |  |  |  | Zach | 
Phase 0 — Infra | IAM.03 | Tighten S3 policy prefixes | ✔ | acct=354630286254; bucket=lifebook.ai; broad /* is read-only (no write/public); ok |  |  |  | Zach | 
Phase 0 — Infra | PREF.02 | Preflight follow-ups | ✔ | QuickVerify exit=0; CI=.github/workflows/quick-verify.yml; sample= |  |  |  | Zach | 
Phase 0 — Prod S3 Data | STG.PROD.02 | Prod S3 follow-ups | ✔ | Buckets=lifebook-354630286254-prod-processed,lifebook-354630286254-prod-uploads,lifebook-logs-prod,lifebook-prod-processed,lifebook-prod-processed-354630286254,lifebook-prod-uploads,lifebook-prod-uploads-354630286254,lifebook-tfstate-354630286254-us-east-1,lifebook.ai; LogBuck… |  |  |  | Zach | 
Phase D.S2 — Catalog prefixes | LFC.DS2 | Catalog lifecycle | ✔ | acct=354630286254; region=us-east-1; lifecycle=ops/s3-lifecycle-catalog.json; lifebook-354630286254-prod-processed:OK(1); lifebook-354630286254-prod-uploads:OK(1); lifebook-logs-prod:OK(3); lifebook-prod-processed:OK(1); lifebook-prod-processed-354630286254:OK(1); lifebook-pro… |  |  |  | Zach | 
Phase 3 — 13A | OIDC.02 | Wire OIDC in workflow + docs | ✔ | provider=arn:aws:iam::354630286254:oidc-provider/token.actions.githubusercontent.com; role=arn:aws:iam::354630286254:role/GitHubActionsOIDC; repo=LifebookAI/Lifebook-Site; region=us-east-1 |  |  |  | Zach | 
