locals {
  # Minimal, safe defaults for this module. Adjust later if you centralize tags.
  common_tags = {
    Project   = "lifebook"
    Stack     = "orchestrator"
    ManagedBy = "terraform"
    Env       = "prod"
  }
}
