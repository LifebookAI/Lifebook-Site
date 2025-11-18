# Orchestrator Terraform Stack

Home for Lifebook orchestrator infrastructure (SQS queue, worker Lambda, EventBridge rules, DLQs, etc).

Current status:
- Provider and tagging locals defined.
- No resources are created yet (this stack is a skeleton).

Next:
- Import existing `lifebook-orchestrator-queue` into this stack.
- Add IAM roles, worker Lambda, and EventBridge wiring.
