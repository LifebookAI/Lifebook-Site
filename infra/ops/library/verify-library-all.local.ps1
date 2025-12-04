[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[INFO] Running all Library verifiers against $BaseUrl" -ForegroundColor Cyan

Write-Host "[STEP] Running Library UI verifier..." -ForegroundColor Yellow
pwsh infra/ops/library/verify-library-ui.local.ps1 -BaseUrl $BaseUrl
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Library UI verifier failed (see logs above)." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "[STEP] Running Library run verifier..." -ForegroundColor Yellow
pwsh infra/ops/library/verify-library-run.local.ps1 -BaseUrl $BaseUrl
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Library run verifier failed (see logs above)." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "[OK] All Library verifiers passed (UI + run)." -ForegroundColor Green
