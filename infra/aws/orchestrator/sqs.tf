# Orchestrator SQS queue (existing resource, imported into state).
# NOTE:
# - This configuration intentionally uses lifecycle.ignore_changes = all
#   so Terraform tracks the queue in state but does NOT modify its settings yet.
# - Once the full desired configuration is modeled (visibility timeout,
#   DLQ, KMS key, etc.), we can narrow or remove ignore_changes.

resource "aws_sqs_queue" "orchestrator" {
  name = "lifebook-orchestrator-queue"

  tags = merge(
    local.tags,
    {
      "Queue" = "lifebook-orchestrator-queue"
      "Role"  = "orchestrator"
    }
  )

  lifecycle {
    ignore_changes = all
  }
}
