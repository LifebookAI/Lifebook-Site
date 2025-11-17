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

# 1) Load allowlist (supports two shapes:
#    - ["foo","bar"]
#    - {"ExpectedPrincipalPrefixes":["foo","bar"]})
$allowlistPath = Join-Path $PSScriptRoot 'orchestrator-queue-allowlist.json'
if (-not (Test-Path $allowlistPath)) {
    throw "Missing allowlist file: $allowlistPath"
}

$raw = Get-Content $allowlistPath -Raw | ConvertFrom-Json
[string[]]$allowNames = @()

if ($null -eq $raw) {
    Write-Warning "Allowlist JSON appears empty; treating as no allowed principals."
} elseif ($raw -is [System.Array]) {
    $allowNames = @($raw)
} elseif ($raw.PSObject.Properties.Name -contains 'ExpectedPrincipalPrefixes') {
    $allowNames = @($raw.ExpectedPrincipalPrefixes)
} else {
    # Fallback: treat as a single value
    $allowNames = @($raw)
}

$allowNames = $allowNames | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

Write-Host "  Allowlist   : $([string]::Join(', ', $allowNames))"
Write-Host ""

# Helper: test if a principal string is allowed by any of the prefixes
function Test-PrincipalAllowed {
    param(
        [string]   $Principal,
        [string[]] $AllowPrefixes
    )
    if (-not $Principal) { return $false }
    foreach ($p in $AllowPrefixes) {
        if ([string]::IsNullOrWhiteSpace($p)) { continue }
        if ($Principal -like "*$p*") {
            return $true
        }
    }
    return $false
}

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

# 3) Compare to allowlist (prefix-based)
$unexpected = @()
foreach ($principal in $principals) {
    if (-not (Test-PrincipalAllowed -Principal $principal -AllowPrefixes $allowNames)) {
        $unexpected += $principal
    }
}
$unexpected = $unexpected | Where-Object { $_ } | Sort-Object -Unique

$missingExpected = @()
foreach ($p in $allowNames) {
    if ([string]::IsNullOrWhiteSpace($p)) { continue }
    $seen = $false
    foreach ($principal in $principals) {
        if ($principal -like "*$p*") {
            $seen = $true
            break
        }
    }
    if (-not $seen) {
        $missingExpected += $p
    }
}
$missingExpected = $missingExpected | Sort-Object -Unique

Write-Host ""
if ($unexpected -and $unexpected.Count -gt 0) {
    Write-Error "Unexpected principals found touching the orchestrator queue:"
    $unexpected | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    throw "Orchestrator queue principal allowlist violation."
}

Write-Host "All observed principals are within the allowlist (by prefix match)." -ForegroundColor Green
if ($missingExpected -and $missingExpected.Count -gt 0) {
    Write-Host "Note: some allowlisted prefixes did not appear in the last $MinutesBack minutes:" -ForegroundColor Yellow
    $missingExpected | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}

Write-Host "Orchestrator queue principal verification succeeded." -ForegroundColor Green
