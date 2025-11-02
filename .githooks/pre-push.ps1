#requires -Version 7
$ErrorActionPreference='Stop'

# Resolve repo root reliably
$repo = (git rev-parse --show-toplevel).Trim()
if (-not $repo) { Write-Error "pre-push: cannot resolve repo root"; exit 1 }

$script = Join-Path $repo 'infra/ops/progress/progress.ps1'
if (-not (Test-Path $script)) {
  Write-Error "pre-push: $script not found; run setup first."
  exit 1
}

# Enforce that today's progress was recorded
pwsh -NoLogo -NoProfile -File $script guard
