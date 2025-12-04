[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[INFO] Verifying dev Library run inspector UI against $BaseUrl" -ForegroundColor Cyan

$uri = "$BaseUrl/dev/library/run-inspector"
Write-Host "[STEP] GET $uri (dev Library run inspector page)" -ForegroundColor Yellow

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
    Write-Host "[FAIL] /dev/library/run-inspector returned an empty body." -ForegroundColor Red
    exit 1
}

if ($resp.Content -notmatch "Library run inspector") {
    Write-Host "[FAIL] Run inspector page did not contain the 'Library run inspector' heading text." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Dev Library run inspector UI responded with 200 and expected heading." -ForegroundColor Green
