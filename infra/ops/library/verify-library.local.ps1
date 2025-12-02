param(
    [string]$BaseUrl = 'http://localhost:3000'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host "Verifying Library against $BaseUrl ..." -ForegroundColor Cyan

# Hit /api/library and parse JSON
try {
    $resp = Invoke-RestMethod -Uri "$BaseUrl/api/library" -Method Get -TimeoutSec 10
} catch {
    Write-Host "[FAIL] Request to $BaseUrl/api/library failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Normalize to an array of items
if ($null -eq $resp) {
    $items = @()
} elseif ($resp.PSObject.Properties.Name -contains 'items' -and $resp.items -ne $null) {
    $items = $resp.items
} elseif ($resp -is [System.Array]) {
    $items = $resp
} else {
    # Fallback: treat the single object as one item
    $items = @($resp)
}

$count = ($items | Measure-Object).Count

if ($count -eq 0) {
    if ($env:CI -eq 'true') {
        Write-Host "[WARN] /api/library returned 0 items in CI; treating as empty-state allowed." -ForegroundColor DarkYellow
    } else {
        Write-Host "[FAIL] /api/library returned 0 items (expected at least one workflow run)." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[OK] /api/library returned $count item(s)." -ForegroundColor Green
}

exit 0
