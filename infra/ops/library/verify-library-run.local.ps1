[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[INFO] Verifying Library run endpoint against $BaseUrl" -ForegroundColor Cyan

# -------------------------
# 1) Happy path: workflow.hello-library
# -------------------------
$helloUri = "$BaseUrl/api/library/hello-library/run"
Write-Host "[STEP] POST $helloUri (hello-library run)" -ForegroundColor Yellow

try {
    $helloResp = Invoke-WebRequest -Uri $helloUri -UseBasicParsing -TimeoutSec 15 -Method Post -ContentType "application/json" -Body "{}"
}
catch {
    Write-Host "[FAIL] Request to $helloUri failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "       Is 'npm run dev' running on $BaseUrl ?" -ForegroundColor Red
    exit 1
}

if ($helloResp.StatusCode -ne 200) {
    Write-Host "[FAIL] POST $helloUri returned HTTP $($helloResp.StatusCode) (expected 200)." -ForegroundColor Red
    exit 1
}

if (-not $helloResp.Content -or -not $helloResp.Content.Trim()) {
    Write-Host "[FAIL] Run endpoint returned an empty body for hello-library." -ForegroundColor Red
    exit 1
}

try {
    $helloJson = $helloResp.Content | ConvertFrom-Json
}
catch {
    Write-Host "[FAIL] Failed to parse JSON from hello-library run endpoint: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if (-not $helloJson.ok) {
    Write-Host "[FAIL] hello-library run response ok=false. Error: $($helloJson.error)" -ForegroundColor Red
    exit 1
}

if (-not $helloJson.runId -or -not $helloJson.runId.ToString().Trim()) {
    Write-Host "[FAIL] hello-library run response missing runId." -ForegroundColor Red
    exit 1
}

if ($helloJson.libraryItemId -ne "workflow.hello-library") {
    Write-Host "[FAIL] hello-library libraryItemId was '$($helloJson.libraryItemId)', expected 'workflow.hello-library'." -ForegroundColor Red
    exit 1
}

if (-not $helloJson.status -or -not $helloJson.status.ToString().Trim()) {
    Write-Host "[FAIL] hello-library run response missing status." -ForegroundColor Red
    exit 1
}

if ($helloJson.status -ne "pending") {
    Write-Host "[FAIL] hello-library status was '$($helloJson.status)', expected 'pending' for a freshly-started run." -ForegroundColor Red
    exit 1
}

$createdAt = $helloJson.createdAt

if (-not $createdAt) {
    Write-Host "[FAIL] hello-library run response missing createdAt." -ForegroundColor Red
    exit 1
}

# Convert to string safely even if it's already a [datetime]
$createdAtStr = $createdAt.ToString()

if (-not $createdAtStr.Trim()) {
    Write-Host "[FAIL] hello-library createdAt is empty after ToString()." -ForegroundColor Red
    exit 1
}

try {
    [void][datetime]::Parse($createdAtStr)
}
catch {
    Write-Host "[FAIL] hello-library createdAt '$createdAtStr' is not a valid datetime." -ForegroundColor Red
    exit 1
}

Write-Host ("[OK] hello-library: ok=true with runId '{0}', libraryItemId '{1}', status '{2}', createdAt '{3}'." -f `
    $helloJson.runId, $helloJson.libraryItemId, $helloJson.status, $createdAtStr) -ForegroundColor Green

# -------------------------
# 2) Negative path: non-runnable track (aws-foundations)
# -------------------------
$trackUri = "$BaseUrl/api/library/aws-foundations/run"
Write-Host "[STEP] POST $trackUri (aws-foundations run - expect 400)" -ForegroundColor Yellow

try {
    $trackResp = Invoke-WebRequest -Uri $trackUri -UseBasicParsing -TimeoutSec 15 -Method Post -ContentType "application/json" -Body "{}" -SkipHttpErrorCheck
}
catch {
    Write-Host "[FAIL] Request to $trackUri failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if ($trackResp.StatusCode -ne 400) {
    Write-Host "[FAIL] POST $trackUri returned HTTP $($trackResp.StatusCode) (expected 400)." -ForegroundColor Red
    exit 1
}

if (-not $trackResp.Content -or -not $trackResp.Content.Trim()) {
    Write-Host "[FAIL] aws-foundations run endpoint returned an empty body." -ForegroundColor Red
    exit 1
}

try {
    $trackJson = $trackResp.Content | ConvertFrom-Json
}
catch {
    Write-Host "[FAIL] Failed to parse JSON from aws-foundations run endpoint: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if ($trackJson.ok) {
    Write-Host "[FAIL] aws-foundations run response ok=true (expected ok=false for non-runnable track)." -ForegroundColor Red
    exit 1
}

if (-not $trackJson.error -or -not $trackJson.error.ToString().Trim()) {
    Write-Host "[FAIL] aws-foundations error message missing (expected a helpful error about workflow-template only)." -ForegroundColor Red
    exit 1
}

Write-Host ("[OK] aws-foundations: correctly rejected with HTTP 400, ok=false, error='{0}'." -f $trackJson.error) -ForegroundColor Green

# -------------------------
# 3) Negative path: missing item
# -------------------------
$missingUri = "$BaseUrl/api/library/no-such-item/run"
Write-Host "[STEP] POST $missingUri (missing item - expect 404)" -ForegroundColor Yellow

try {
    $missingResp = Invoke-WebRequest -Uri $missingUri -UseBasicParsing -TimeoutSec 15 -Method Post -ContentType "application/json" -Body "{}" -SkipHttpErrorCheck
}
catch {
    Write-Host "[FAIL] Request to $missingUri failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if ($missingResp.StatusCode -ne 404) {
    Write-Host "[FAIL] POST $missingUri returned HTTP $($missingResp.StatusCode) (expected 404)." -ForegroundColor Red
    exit 1
}

if (-not $missingResp.Content -or -not $missingResp.Content.Trim()) {
    Write-Host "[FAIL] missing-item run endpoint returned an empty body." -ForegroundColor Red
    exit 1
}

try {
    $missingJson = $missingResp.Content | ConvertFrom-Json
}
catch {
    Write-Host "[FAIL] Failed to parse JSON from missing-item run endpoint: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if ($missingJson.ok) {
    Write-Host "[FAIL] missing-item run response ok=true (expected ok=false for a missing item)." -ForegroundColor Red
    exit 1
}

if ($missingJson.error -ne "Library item not found.") {
    Write-Host "[FAIL] missing-item error was '$($missingJson.error)', expected 'Library item not found.'." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] missing-item: correctly rejected with HTTP 404, ok=false, error='Library item not found.'." -ForegroundColor Green

Write-Host "[OK] Library run endpoint passed happy-path + negative-case verification." -ForegroundColor Green
