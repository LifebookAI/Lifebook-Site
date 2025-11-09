import { track } from "../lib/analytics/track";

// A1 path: Source connected -> Workflow run -> Artifact saved
track("source_connected", { workspace_id: "w-TEST", user_id: "u-TEST", source_type: "sample", provider: "sample", success: true });
track("workflow_run_started", { job_id: "j-TEST", workspace_id: "w-TEST", user_id: "u-TEST", trigger_type: "manual", plan_tier: "Free", credits_estimate: 3 });
track("artifact_saved", { artifact_id: "a-TEST", job_id: "j-TEST", workspace_id: "w-TEST", type: "doc", format: "md", sha256: "deadbeef", bytes: 1234 });
