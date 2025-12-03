[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[INFO] Verifying Library run endpoint against $BaseUrl" -ForegroundColor Cyan

$uri = "$BaseUrl/api/library/hello-library/run"
Write-Host "[STEP] POST $uri (hello-library run)" -ForegroundColor Yellow

try {
    $resp = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 15 -Method Post -ContentType "application/json" -Body "{}"
}
catch {
    Write-Host "[FAIL] Request to $uri failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "       Is 'npm run dev' running on $BaseUrl ?" -ForegroundColor Red
    exit 1
}

if ($resp.StatusCode -ne 200) {
    Write-Host "[FAIL] POST $uri returned HTTP $($resp.StatusCode) (expected 200)." -ForegroundColor Red
    exit 1
}

if (-not $resp.Content -or -not $resp.Content.Trim()) {
    Write-Host "[FAIL] Run endpoint returned an empty body." -ForegroundColor Red
    exit 1
}

try {
    $json = $resp.Content | ConvertFrom-Json
}
catch {
    Write-Host "[FAIL] Failed to parse JSON from run endpoint: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if (-not $json.ok) {
    Write-Host "[FAIL] Run response ok=false. Error: $($json.error)" -ForegroundColor Red
    exit 1
}

if (-not $json.runId -or -not $json.runId.ToString().Trim()) {
    Write-Host "[FAIL] Run response missing runId." -ForegroundColor Red
    exit 1
}

if ($json.libraryItemId -ne "workflow.hello-library") {
    Write-Host "[FAIL] libraryItemId was '$($json.libraryItemId)', expected 'workflow.hello-library'." -ForegroundColor Red
    exit 1
}

if (-not $json.status -or -not $json.status.ToString().Trim()) {
    Write-Host "[FAIL] Run response missing status." -ForegroundColor Red
    exit 1
}

if ($json.status -ne "pending") {
    Write-Host "[FAIL] status was '$($json.status)', expected 'pending' for a freshly-started run." -ForegroundColor Red
    exit 1
}

$createdAt = $json.createdAt

if (-not $createdAt) {
    Write-Host "[FAIL] Run response missing createdAt." -ForegroundColor Red
    exit 1
}

# Convert to string safely even if it's already a [datetime]
$createdAtStr = $createdAt.ToString()

if (-not $createdAtStr.Trim()) {
    Write-Host "[FAIL] createdAt is empty after ToString()." -ForegroundColor Red
    exit 1
}

try {
    [void][datetime]::Parse($createdAtStr)
}
catch {
    Write-Host "[FAIL] createdAt '$createdAtStr' is not a valid datetime." -ForegroundColor Red
    exit 1
}

Write-Host ("[OK] Run endpoint returned ok=true with runId '{0}', libraryItemId '{1}', status '{2}', createdAt '{3}'." -f `
    $json.runId, $json.libraryItemId, $json.status, $createdAtStr) -ForegroundColor Green
