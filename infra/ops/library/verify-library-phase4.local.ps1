param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[INFO] Running Phase 4 Library smoke suite against $BaseUrl" -ForegroundColor Cyan

# Resolve repo root from this script's location (infra/ops/library)
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")

$libAllPath       = Join-Path $PSScriptRoot 'verify-library-all.local.ps1'
$libRunDetailPath = Join-Path $PSScriptRoot 'verify-library-run-detail.local.ps1'
$dbVerifyPath     = Join-Path $RepoRoot 'infra/ops/db/verify-jobs-table.local.ps1'

foreach ($p in @($libAllPath, $libRunDetailPath, $dbVerifyPath)) {
    if (-not (Test-Path -LiteralPath $p)) {
        throw "Required verifier not found: $p"
    }
}

Write-Host "[STEP] Library UI + run endpoint verifier" -ForegroundColor Yellow
pwsh $libAllPath -BaseUrl $BaseUrl
if ($LASTEXITCODE -ne 0) {
    throw "verify-library-all.local.ps1 failed with exit code $LASTEXITCODE."
}

Write-Host "[STEP] Jobs table schema + sample rows verifier" -ForegroundColor Yellow
pwsh $dbVerifyPath
if ($LASTEXITCODE -ne 0) {
    throw "verify-jobs-table.local.ps1 failed with exit code $LASTEXITCODE."
}

Write-Host "[STEP] Library run detail page verifier" -ForegroundColor Yellow
pwsh $libRunDetailPath -BaseUrl $BaseUrl
if ($LASTEXITCODE -ne 0) {
    throw "verify-library-run-detail.local.ps1 failed with exit code $LASTEXITCODE."
}

Write-Host "[OK] Phase 4 Library smoke suite completed successfully." -ForegroundColor Green
