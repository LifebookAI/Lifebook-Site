[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[INFO] Verifying Library activity view against $BaseUrl" -ForegroundColor Cyan

$uri = "$BaseUrl/library/activity"
Write-Host "[STEP] GET $uri (Library activity)" -ForegroundColor Yellow

try {
    $resp = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 15 -Method Get
}
catch {
    Write-Host "[FAIL] Request to $uri failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "       Is 'npm run dev' running on $BaseUrl ?" -ForegroundColor Red
    exit 1
}

if ($resp.StatusCode -ne 200) {
    Write-Host "[FAIL] GET $uri returned HTTP $($resp.StatusCode) (expected 200)." -ForegroundColor Red
    exit 1
}

if (-not $resp.Content -or -not $resp.Content.Trim()) {
    Write-Host "[FAIL] /library/activity returned an empty body." -ForegroundColor Red
    exit 1
}

if ($resp.Content -notmatch "Library activity") {
    Write-Host "[FAIL] /library/activity did not contain the 'Library activity' heading text." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Library activity view responded with 200 and expected heading." -ForegroundColor Green
