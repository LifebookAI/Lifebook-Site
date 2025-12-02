[CmdletBinding()]
param(
    # Base URL for the dev server
    [string]$BaseUrl = "http://localhost:3000",

    # Minimum number of Library items we expect from the catalog
    [int]$ExpectedMinItems = 3
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$uri = "$BaseUrl/api/library"
Write-Host "[STEP] GET $uri" -ForegroundColor Yellow

try {
    $resp = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 10
}
catch {
    Write-Host "[FAIL] Request to $uri failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "       Is 'npm run dev' running on $BaseUrl ?" -ForegroundColor Red
    exit 1
}

if ($resp.StatusCode -ne 200) {
    Write-Host "[FAIL] /api/library returned HTTP $($resp.StatusCode) (expected 200)." -ForegroundColor Red
    exit 1
}

if (-not $resp.Content -or -not $resp.Content.Trim()) {
    Write-Host "[FAIL] /api/library returned an empty body." -ForegroundColor Red
    exit 1
}

try {
    $json = $resp.Content | ConvertFrom-Json
}
catch {
    Write-Host "[FAIL] Failed to parse JSON from /api/library: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Normalize to array
$items = @($json)
$count = $items.Count

if ($count -lt $ExpectedMinItems) {
    Write-Host "[FAIL] /api/library returned only $count item(s), expected at least $ExpectedMinItems." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] /api/library returned $count item(s)." -ForegroundColor Green

# Check for the three seed IDs from catalog.v1.json
$requiredIds = @(
    "workflow.hello-library",
    "track.aws-foundations",
    "track.devops-essentials"
)

$missing = @()

foreach ($id in $requiredIds) {
    if (-not ($items.id -contains $id)) {
        $missing += $id
    }
}

if ($missing.Count -gt 0) {
    Write-Host "[FAIL] Missing required catalog id(s): $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Found required catalog IDs: $($requiredIds -join ', ')" -ForegroundColor Green

# Optional: small table for eyeballing the response
$items |
    Select-Object `
        @{ Name = "Id";     Expression = { $_.id } },
        @{ Name = "Kind";   Expression = { $_.kind } },
        @{ Name = "Title";  Expression = { $_.title } },
        @{ Name = "Status"; Expression = { $_.status } } |
    Format-Table -AutoSize
