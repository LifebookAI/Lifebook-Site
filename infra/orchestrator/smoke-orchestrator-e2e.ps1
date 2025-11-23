# NORMAL (PS7) — Orchestrator E2E smoke: API /api/jobs → DynamoDB → S3 result.md (+ run logs if present)
param(
    [string]$BaseUrl
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Discover repo root (git if present, else current directory)
$Repo = $null
try {
    $Repo = (git rev-parse --show-toplevel 2>$null).Trim()
} catch {
    $Repo = $null
}
if (-not $Repo) {
    $Repo = (Get-Location).Path
}

$OrchDir   = Join-Path $Repo 'infra/orchestrator'
$ApiSmoke  = Join-Path $OrchDir 'smoke-api-jobs.ps1'
$StateSmoke = Join-Path $OrchDir 'smoke-orchestrator-ddb-s3.ps1'

if (-not (Test-Path $ApiSmoke)) {
    throw "Missing '$ApiSmoke' (API smoke)."
}
if (-not (Test-Path $StateSmoke)) {
    throw "Missing '$StateSmoke' (DDB/S3 smoke)."
}

Write-Host "Repo root : $Repo"        -ForegroundColor Cyan
Write-Host "API smoke : $ApiSmoke"    -ForegroundColor DarkCyan
Write-Host "DDB/S3 smoke: $StateSmoke" -ForegroundColor DarkCyan
Write-Host ""

# -----------------------
# Step 1: hit /api/jobs (create a sample orchestrator job)
# -----------------------
Write-Host "Step 1/2: Hitting /api/jobs via smoke-api-jobs.ps1..." -ForegroundColor Yellow

$apiArgs = @()
if ($BaseUrl -and $BaseUrl.Trim()) {
    Write-Host "Using BaseUrl override: $BaseUrl" -ForegroundColor DarkYellow
    $apiArgs += '-BaseUrl'
    $apiArgs += $BaseUrl
}

& pwsh -NoProfile -ExecutionPolicy Bypass $ApiSmoke @apiArgs
$apiExit = $LASTEXITCODE

if ($apiExit -ne 0) {
    Write-Host "smoke-api-jobs.ps1 failed with exit code $apiExit." -ForegroundColor Red
    Write-Host "E2E smoke FAILED at API step." -ForegroundColor Red
    exit $apiExit
}

Write-Host ""
Write-Host "Step 1 OK — /api/jobs responded successfully and should have created a new job." -ForegroundColor Green

# -----------------------
# Step 2: Inspect latest job in DynamoDB + S3 result
# -----------------------
Write-Host ""
Write-Host "Step 2/2: Inspecting latest job (DynamoDB job row + run logs + S3 result.md)..." -ForegroundColor Yellow

& pwsh -NoProfile -ExecutionPolicy Bypass $StateSmoke
$stateExit = $LASTEXITCODE

if ($stateExit -ne 0) {
    Write-Host "smoke-orchestrator-ddb-s3.ps1 failed with exit code $stateExit." -ForegroundColor Red
    Write-Host "E2E smoke FAILED at DDB/S3 step." -ForegroundColor Red
    exit $stateExit
}

Write-Host ""
Write-Host "E2E orchestrator smoke PASSED: /api/jobs → DynamoDB → S3 (and run logs if present)." -ForegroundColor Green
exit 0
