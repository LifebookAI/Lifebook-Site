## Paste-run conventions

- Run from repo root (git rev-parse --show-toplevel).

- Use \infra/ops/Invoke-LifebookOps.ps1 QuickVerify\ for one-click checks.

- Record progress: \infra/ops/progress/progress.ps1 done -StepID "<ID>" -Status "✔" -Evidence "<evidence>" -Next ""\.

- Stage only: \logs/build-progress.json\ and \progress_block.md\ when pushing progress-only commits.
