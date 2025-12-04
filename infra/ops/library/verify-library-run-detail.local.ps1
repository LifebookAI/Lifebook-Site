param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[INFO] Verifying Library run detail page against $BaseUrl" -ForegroundColor Cyan

# 1) Create a fresh Library run via API
Write-Host "[STEP] POST $BaseUrl/api/library/hello-library/run" -ForegroundColor Yellow
$runResp = Invoke-RestMethod -Uri "$BaseUrl/api/library/hello-library/run" -Method Post

if (-not $runResp.ok) {
    throw "Library run API returned ok=false. Raw response: $($runResp | ConvertTo-Json -Depth 5)"
}

$runId  = $runResp.runId
$runUrl = "$BaseUrl/library/runs/$runId"

Write-Host "[OK] Got runId: $runId (status=$($runResp.status), item=$($runResp.libraryItemId))" -ForegroundColor Green

# 2) Hit the run detail page
Write-Host "[STEP] GET $runUrl" -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri $runUrl -Method Get -ErrorAction Stop

if ($response.StatusCode -ne 200) {
    throw "Expected 200 from $runUrl but got $($response.StatusCode)."
}

Write-Host "[OK] /library/runs/$runId responded with HTTP 200." -ForegroundColor Green
Write-Host "[OK] Library run detail verifier completed successfully." -ForegroundColor Green
