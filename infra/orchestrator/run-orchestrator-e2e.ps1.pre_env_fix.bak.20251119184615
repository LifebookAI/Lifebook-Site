# NORMAL (PS7) — Run orchestrator E2E smoke in child pwsh, honor exit code

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 1) Resolve repo root
$repo = (git rev-parse --show-toplevel).Trim()
if (-not $repo) {
    throw "Not inside a git repo; run this from within the Lifebook-Site repo."
}
Set-Location $repo

# 2) Ensure AWS context (override if needed)
if (-not $env:AWS_PROFILE) { $env:AWS_PROFILE = 'lifebook-sso' }
if (-not $env:AWS_REGION)  { $env:AWS_REGION  = 'us-east-1' }

# Orchestrator table override (optional)
if (-not $env:LFLBK_ORCH_JOBS_TABLE) {
    $env:LFLBK_ORCH_JOBS_TABLE = 'lifebook-orchestrator-jobs'
}

# 3) Locate smoke script
$smokePath = Join-Path $repo 'infra/orchestrator/smoke-orchestrator-e2e.ps1'
if (-not (Test-Path $smokePath)) {
    throw "Smoke script not found: $smokePath"
}

Write-Host "[orchestrator-e2e] Running orchestrator smoke in child PowerShell..." -ForegroundColor Cyan

# 4) Run smoke script in a child pwsh so its 'exit 0/1' doesn't kill this shell
& pwsh -NoProfile -ExecutionPolicy Bypass -File $smokePath
$code = $LASTEXITCODE

Write-Host "[orchestrator-e2e] Child smoke exit code: $code" -ForegroundColor Cyan

if ($code -ne 0) {
    Write-Host "[orchestrator-e2e] Smoke FAILED with exit code $code." -ForegroundColor Red
    exit $code
}

Write-Host "[orchestrator-e2e] Smoke completed successfully with exit code 0." -ForegroundColor Green
exit 0
