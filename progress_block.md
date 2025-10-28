Phase | Step ID | Step Title | Status (☐/⏳/✔/⛔) | Evidence (IDs/ARNs/links) | Decisions | Blockers | Next actions (max 3) | Owner | Target (YYYY-MM-DD)
--- | --- | --- | --- | --- | --- | --- | --- | --- | ---
Phase 0 — Infra | NET.20 | Bastion follow-ups | ⏳ | NET.20 verify → scheduler-role-missing, no-bastion |  |  | Tag instance(s) Component=bastion; re-run NET.20 apply | Zach |
Phase 0 — S3 Artifacts | STG.ART.02 | Artifacts follow-ups | ✔ | Bucket=lifebook-artifacts-354630286254-us-east-1; LogsBucket=lifebook-s3-logs-354630286254-us-east-1; Ownership=BucketOwnerPreferred; SSEAlgo=aws:kms; BucketKey=True; KMSAllow=arn:aws:kms:us-east-1:354630286254:key/97531fff-036c-4b72-b7b3-a1ad685110b4\|97531fff-036c-4b72-b7b3-a… |  |  |  | Zach |
