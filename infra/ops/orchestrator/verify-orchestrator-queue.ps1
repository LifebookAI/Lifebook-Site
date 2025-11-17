param(
    [int]   $MinutesBack = 60,
    [string]$Profile     = 'lifebook-sso',
    [string]$Region      = 'us-east-1'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host "Orchestrator queue verification" -ForegroundColor Cyan
Write-Host "  MinutesBack : $MinutesBack"
Write-Host "  Profile     : $Profile"
Write-Host "  Region      : $Region"

# 1) Load allowlist (JSON array of allowed principal names)
$allowlistPath = Join-Path $PSScriptRoot 'orchestrator-queue-allowlist.json'
if (-not (Test-Path $allowlistPath)) {
    throw "Missing allowlist file: $allowlistPath"
}

$allowNames = Get-Content $allowlistPath -Raw | ConvertFrom-Json
if (-not $allowNames) {
    Write-Warning "Allowlist JSON appears empty; treating as no allowed principals."
    $allowNames = @()
}

Write-Host "  Allowlist   : $([string]::Join(', ', @($allowNames)))"
Write-Host ""

# 2) Call who-touched-queue.ps1
$whoScript = Join-Path $PSScriptRoot 'who-touched-queue.ps1'
if (-not (Test-Path $whoScript)) {
    throw "Missing script: $whoScript"
}

$queueInfo = & $whoScript -Profile $Profile -Region $Region -MinutesBack $MinutesBack

if ($queueInfo.MissingOrInaccessible) {
    Write-Warning "Queue '$($queueInfo.QueueName)' is missing or inaccessible. Treating as SKIP (no principals to verify) until orchestrator infra is deployed."
    return
}

$principals = @()
if ($queueInfo.Principals) {
    $principals = @($queueInfo.Principals)
}

if (-not $principals -or $principals.Count -eq 0) {
    Write-Host "No CloudTrail activity found for '$($queueInfo.QueueName)' in the last $MinutesBack minutes." -ForegroundColor Green
    Write-Host "Nothing to compare against allowlist; treating as OK."
    return
}

Write-Host "Principals that touched '$($queueInfo.QueueName)' in the last $MinutesBack minutes:" -ForegroundColor Cyan
$principals | Sort-Object | ForEach-Object { Write-Host "  - $_" }

# 3) Compare to allowlist
$unexpected = $principals | Where-Object { $_ -and ($allowNames -notcontains $_) } | Sort-Object -Unique
$missingExpected = $allowNames | Where-Object { $_ -and ($principals -notcontains $_) } | Sort-Object -Unique

Write-Host ""
if ($unexpected -and $unexpected.Count -gt 0) {
    Write-Error "Unexpected principals found touching the orchestrator queue:"
    $unexpected | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    throw "Orchestrator queue principal allowlist violation."
}

Write-Host "All observed principals are within the allowlist." -ForegroundColor Green
if ($missingExpected -and $missingExpected.Count -gt 0) {
    Write-Host "Note: some allowlisted principals did not appear in the last $MinutesBack minutes:" -ForegroundColor Yellow
    $missingExpected | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}

Write-Host "Orchestrator queue principal verification succeeded." -ForegroundColor Green
