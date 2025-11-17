param(
    [Parameter()]
    [int]$MinutesBack = 60,

    [Parameter()]
    [string]$Profile,

    [Parameter()]
    [string]$Region,

    [Parameter()]
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Aws {
    param(
        [Parameter(Mandatory, ValueFromRemainingArguments)]
        [string[]]$Cmd
    )
    $out = & aws @Cmd 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ("aws " + ($Cmd -join ' ') + " failed:`n" + $out)
    }
    try {
        $out | ConvertFrom-Json
    } catch {
        $out
    }
}

# ---- Resolve repo + paths ----
$Repo = $null
try {
    $Repo = (git rev-parse --show-toplevel 2>$null).Trim()
} catch {
    $Repo = $null
}

if (-not $Repo) {
    $Repo = Get-Location
}

$OrchestratorDir = Join-Path $Repo 'infra/ops/orchestrator'
$WhoScriptPath   = Join-Path $OrchestratorDir 'who-touched-queue.ps1'
$AllowlistPath   = Join-Path $OrchestratorDir 'orchestrator-queue-allowlist.json'

if (-not (Test-Path $WhoScriptPath)) {
    throw "who-touched-queue.ps1 not found at $WhoScriptPath"
}
if (-not (Test-Path $AllowlistPath)) {
    throw "Allowlist JSON not found at $AllowlistPath"
}

# ---- Resolve AWS profile/region ----
if (-not $Profile) {
    $Profile = $env:AWS_PROFILE
    if (-not $Profile) { $Profile = 'lifebook-sso' }
}
if (-not $Region) {
    $Region = $env:AWS_REGION
    if (-not $Region) { $Region = 'us-east-1' }
}

# ---- Load allowlist ----
$allowRaw = Get-Content -Path $AllowlistPath -Raw
$allowCfg = $allowRaw | ConvertFrom-Json

[string[]]$expectedPrefixes = @()
if ($allowCfg.ExpectedPrincipalPrefixes) {
    $expectedPrefixes = @($allowCfg.ExpectedPrincipalPrefixes)
}

if (-not $Quiet) {
    Write-Host "Orchestrator queue verification" -ForegroundColor Yellow
    Write-Host "  MinutesBack : $MinutesBack" -ForegroundColor Yellow
    Write-Host "  Profile     : $Profile"     -ForegroundColor Yellow
    Write-Host "  Region      : $Region"      -ForegroundColor Yellow
    Write-Host "  Allowlist   : $($expectedPrefixes -join ', ')" -ForegroundColor Yellow
    Write-Host ""
}

# ---- Run CloudTrail Lake probe (Raw JSON) ----
$rawJson = & $WhoScriptPath -MinutesBack $MinutesBack -Profile $Profile -Region $Region -Raw
if (-not $rawJson) {
    throw "who-touched-queue.ps1 returned no data."
}

$payload = $rawJson | ConvertFrom-Json
$records = @()
if ($payload.Records) {
    $records = @($payload.Records)
}

# ---- Evaluate results ----
$queueUrl    = $payload.QueueUrl
$startWindow = $payload.WindowStartUtc
$endWindow   = $payload.WindowEndUtc

if (-not $Quiet) {
    Write-Host "Evaluating CloudTrail Lake events for queue:" -ForegroundColor Cyan
    Write-Host "  QueueUrl : $queueUrl"    -ForegroundColor Cyan
    Write-Host "  Window   : $startWindow → $endWindow (UTC)" -ForegroundColor Cyan
    Write-Host ""
}

if ($records.Count -eq 0) {
    Write-Host "WARN: No SQS data events for this queue in the selected window (idle or no data events captured)." -ForegroundColor DarkYellow
    # Exit 0 but mark as warn in output
    $summary = [pscustomobject]@{
        Status       = 'WARN'
        Reason       = 'NoEventsInWindow'
        MinutesBack  = $MinutesBack
        QueueUrl     = $queueUrl
        EventCount   = 0
        Unexpected   = @()
        ExpectedList = $expectedPrefixes
    }
    $summary
    exit 0
}

# Flatten principals
$uniquePrincipals = $records |
    Select-Object -ExpandProperty iamPrincipal -Unique |
    Sort-Object

$unexpected = @()

foreach ($p in $uniquePrincipals) {
    $isExpected = $false
    foreach ($prefix in $expectedPrefixes) {
        if ($p -like "$prefix*") {
            $isExpected = $true
            break
        }
    }
    if (-not $isExpected) {
        $unexpected += $p
    }
}

if ($unexpected.Count -eq 0) {
    Write-Host "OK: Only expected principals touched lifebook-orchestrator-queue in the last $MinutesBack minute(s)." -ForegroundColor Green
} else {
    Write-Host "ALERT: Unexpected principals touched lifebook-orchestrator-queue in the last $MinutesBack minute(s)." -ForegroundColor Red
}

# Show a compact table of recent events
$records |
    Select-Object eventTime, eventName, iamPrincipal, sourceIPAddress, vpcEndpointId |
    Sort-Object eventTime -Descending |
    Format-Table -AutoSize

$summaryStatus = if ($unexpected.Count -eq 0) { 'OK' } else { 'ALERT' }

$summary = [pscustomobject]@{
    Status       = $summaryStatus
    MinutesBack  = $MinutesBack
    QueueUrl     = $queueUrl
    EventCount   = $records.Count
    Principals   = $uniquePrincipals
    Unexpected   = $unexpected
    ExpectedList = $expectedPrefixes
}

if (-not $Quiet) {
    Write-Host ""
    Write-Host "Summary:" -ForegroundColor Cyan
    $summary
}

if ($unexpected.Count -gt 0) {
    # Non-zero exit code for CI / nightly ops
    exit 1
} else {
    exit 0
}
