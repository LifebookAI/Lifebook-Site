[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[INFO] Verifying Library run details view against $BaseUrl" -ForegroundColor Cyan

# 1) Start a new run from hello-library to ensure we have a fresh runId
$runUri = "$BaseUrl/api/library/hello-library/run"
Write-Host "[STEP] POST $runUri (hello-library run for details view)" -ForegroundColor Yellow

try {
    $runResp = Invoke-WebRequest -Uri $runUri -UseBasicParsing -TimeoutSec 15 -Method Post -ContentType "application/json" -Body "{}"
}
catch {
    Write-Host "[FAIL] Request to $runUri failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "       Is 'npm run dev' running on $BaseUrl ?" -ForegroundColor Red
    exit 1
}

if ($runResp.StatusCode -ne 200) {
    Write-Host "[FAIL] POST $runUri returned HTTP $($runResp.StatusCode) (expected 200)." -ForegroundColor Red
    exit 1
}

if (-not $runResp.Content -or -not $runResp.Content.Trim()) {
    Write-Host "[FAIL] hello-library run endpoint returned an empty body." -ForegroundColor Red
    exit 1
}

try {
    $runJson = $runResp.Content | ConvertFrom-Json
}
catch {
    Write-Host "[FAIL] Failed to parse JSON from hello-library run endpoint: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if (-not $runJson.ok) {
    Write-Host "[FAIL] hello-library run response ok=false. Error: $($runJson.error)" -ForegroundColor Red
    exit 1
}

if (-not $runJson.runId -or -not $runJson.runId.ToString().Trim()) {
    Write-Host "[FAIL] hello-library run response missing runId." -ForegroundColor Red
    exit 1
}

$runId = $runJson.runId.ToString().Trim()
Write-Host "[OK] Started run with runId '$runId' for details verification." -ForegroundColor Green

# 2) Fetch the run details page
$detailUri = "$BaseUrl/library/runs/$runId"
Write-Host "[STEP] GET $detailUri (Library run details)" -ForegroundColor Yellow

try {
    $detailResp = Invoke-WebRequest -Uri $detailUri -UseBasicParsing -TimeoutSec 15 -Method Get
}
catch {
    Write-Host "[FAIL] Request to $detailUri failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "       Is 'npm run dev' running on $BaseUrl ?" -ForegroundColor Red
    exit 1
}

if ($detailResp.StatusCode -ne 200) {
    Write-Host "[FAIL] GET $detailUri returned HTTP $($detailResp.StatusCode) (expected 200)." -ForegroundColor Red
    exit 1
}

if (-not $detailResp.Content -or -not $detailResp.Content.Trim()) {
    Write-Host "[FAIL] /library/runs/{runId} returned an empty body." -ForegroundColor Red
    exit 1
}

if ($detailResp.Content -notmatch "Run details") {
    Write-Host "[FAIL] Run details page did not contain the 'Run details' heading text." -ForegroundColor Red
    exit 1
}

if ($detailResp.Content -notmatch [Regex]::Escape($runId)) {
    Write-Host "[FAIL] Run details page did not include the runId '$runId'." -ForegroundColor Red
    exit 1
}

if ($detailResp.Content -notmatch "workflow.hello-library") {
    Write-Host "[FAIL] Run details page did not include libraryItemId 'workflow.hello-library'." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Library run details view responded with 200 and displayed the expected heading and payload." -ForegroundColor Green
