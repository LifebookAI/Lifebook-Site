[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[INFO] Verifying dev Library run-from-id API against $BaseUrl" -ForegroundColor Cyan

# 1) Start a new run (hello-library) to get a fresh runId
$runUri = "$BaseUrl/api/library/hello-library/run"
Write-Host "[STEP] POST $runUri (hello-library run to obtain runId)" -ForegroundColor Yellow

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
Write-Host "[OK] Started run with runId '$runId' for run-from-id API verification." -ForegroundColor Green

# 2) Call dev run-from-id API (happy path)
$apiUri = "$BaseUrl/api/dev/library/run-from-id?runId=$([Uri]::EscapeDataString($runId))"
Write-Host "[STEP] GET $apiUri (dev run-from-id API, expect 200)" -ForegroundColor Yellow

try {
    $apiResp = Invoke-WebRequest -Uri $apiUri -UseBasicParsing -TimeoutSec 15 -Method Get
}
catch {
    Write-Host "[FAIL] Request to $apiUri failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if ($apiResp.StatusCode -ne 200) {
    Write-Host "[FAIL] GET $apiUri returned HTTP $($apiResp.StatusCode) (expected 200)." -ForegroundColor Red
    exit 1
}

if (-not $apiResp.Content -or -not $apiResp.Content.Trim()) {
    Write-Host "[FAIL] run-from-id API returned an empty body." -ForegroundColor Red
    exit 1
}

try {
    $apiJson = $apiResp.Content | ConvertFrom-Json
}
catch {
    Write-Host "[FAIL] Failed to parse JSON from run-from-id API: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if (-not $apiJson.ok) {
    Write-Host "[FAIL] run-from-id API ok=false for valid runId. Error: $($apiJson.error)" -ForegroundColor Red
    exit 1
}

if (-not $apiJson.run) {
    Write-Host "[FAIL] run-from-id API did not include a 'run' payload." -ForegroundColor Red
    exit 1
}

if ($apiJson.run.runId -ne $runId) {
    Write-Host "[FAIL] run-from-id API runId was '$($apiJson.run.runId)', expected '$runId'." -ForegroundColor Red
    exit 1
}

if ($apiJson.run.libraryItemId -ne "workflow.hello-library") {
    Write-Host "[FAIL] run-from-id API libraryItemId was '$($apiJson.run.libraryItemId)', expected 'workflow.hello-library'." -ForegroundColor Red
    exit 1
}

if ($apiJson.run.status -ne "pending") {
    Write-Host "[FAIL] run-from-id API status was '$($apiJson.run.status)', expected 'pending'." -ForegroundColor Red
    exit 1
}

if (-not $apiJson.run.createdAt -or -not $apiJson.run.createdAt.ToString().Trim()) {
    Write-Host "[FAIL] run-from-id API createdAt was missing or empty." -ForegroundColor Red
    exit 1
}

try {
    [void][datetime]::Parse($apiJson.run.createdAt.ToString())
}
catch {
    Write-Host "[FAIL] run-from-id API createdAt '$($apiJson.run.createdAt)' is not a valid datetime." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] run-from-id API returned expected payload for hello-library run." -ForegroundColor Green

# 3) Negative path: malformed runId
$badRunId = "not-a-valid-run-id"
$badUri = "$BaseUrl/api/dev/library/run-from-id?runId=$([Uri]::EscapeDataString($badRunId))"
Write-Host "[STEP] GET $badUri (malformed runId - expect 400)" -ForegroundColor Yellow

try {
    $badResp = Invoke-WebRequest -Uri $badUri -UseBasicParsing -TimeoutSec 15 -Method Get -SkipHttpErrorCheck
}
catch {
    Write-Host "[FAIL] Request to $badUri failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if ($badResp.StatusCode -ne 400) {
    Write-Host "[FAIL] GET $badUri returned HTTP $($badResp.StatusCode) (expected 400)." -ForegroundColor Red
    exit 1
}

if (-not $badResp.Content -or -not $badResp.Content.Trim()) {
    Write-Host "[FAIL] run-from-id API (bad runId) returned an empty body." -ForegroundColor Red
    exit 1
}

try {
    $badJson = $badResp.Content | ConvertFrom-Json
}
catch {
    Write-Host "[FAIL] Failed to parse JSON from run-from-id API (bad runId): $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if ($badJson.ok) {
    Write-Host "[FAIL] run-from-id API ok=true for malformed runId (expected ok=false)." -ForegroundColor Red
    exit 1
}

if (-not $badJson.error -or -not $badJson.error.ToString().Trim()) {
    Write-Host "[FAIL] run-from-id API error message missing for malformed runId." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] run-from-id API correctly rejected malformed runId with HTTP 400 and ok=false." -ForegroundColor Green
Write-Host "[OK] Dev Library run-from-id API verification succeeded." -ForegroundColor Green
