param(
    [string]$Profile     = 'lifebook-sso',
    [string]$Region      = 'us-east-1',
    [string]$QueueName   = 'lifebook-orchestrator-queue',
    [int]   $MinutesBack = 60
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
    try { $out | ConvertFrom-Json } catch { $out }
}

Write-Host "who-touched-queue.ps1" -ForegroundColor Cyan
Write-Host "  Profile     : $Profile"
Write-Host "  Region      : $Region"
Write-Host "  QueueName   : $QueueName"
Write-Host "  MinutesBack : $MinutesBack"
Write-Host ""

# 1) Resolve queue URL, but treat missing/unauthorized as a soft condition
try {
    $queueUrlResp = Invoke-Aws sqs get-queue-url `
        --queue-name $QueueName `
        --profile $Profile `
        --region $Region
} catch {
    $msg = $_.Exception.Message
    if ($msg -match 'NonExistentQueue' -or $msg -match 'does not exist or you do not have access') {
        Write-Warning "Queue '$QueueName' not found or not accessible in region '$Region' for profile '$Profile'."
        return [pscustomobject]@{
            QueueName             = $QueueName
            QueueUrl              = $null
            QueueArn              = $null
            Principals            = @()
            Events                = @()
            MissingOrInaccessible = $true
        }
    }
    throw
}

$queueUrl = $queueUrlResp.QueueUrl
if (-not $queueUrl) {
    throw "Could not resolve QueueUrl for '$QueueName'."
}

# 2) Derive queue ARN (deterministic)
$caller    = Invoke-Aws sts get-caller-identity --profile $Profile --region $Region
$accountId = $caller.Account
$queueArn  = "arn:aws:sqs:${Region}:${accountId}:${QueueName}"

Write-Host "  QueueUrl : $queueUrl"
Write-Host "  QueueArn : $queueArn"
Write-Host ""

# 3) Look up recent CloudTrail events for this queue
$endUtc   = Get-Date -AsUTC
$startUtc = $endUtc.AddMinutes(-1 * [math]::Abs($MinutesBack))

$startIso = $startUtc.ToString('o')
$endIso   = $endUtc.ToString('o')

Write-Host "Querying CloudTrail from $startIso to $endIso ..." -ForegroundColor Yellow

$eventsResp = Invoke-Aws cloudtrail lookup-events `
    --lookup-attributes AttributeKey=ResourceName,AttributeValue=$queueArn `
    --start-time $startIso `
    --end-time $endIso `
    --max-results 50 `
    --profile $Profile `
    --region $Region

$records = @()
if ($eventsResp.Events) {
    foreach ($e in $eventsResp.Events) {
        $detail = $null
        try {
            $detail = $e.CloudTrailEvent | ConvertFrom-Json
        } catch {
            $detail = $null
        }

        $principal = $null
        if ($detail -and $detail.userIdentity) {
            $principal = $detail.userIdentity.arn
            if (-not $principal) {
                $principal = $detail.userIdentity.principalId
            }
        }

        # Only keep records that actually mention this ARN as a resource
        $hasResource = $false
        if ($e.Resources) {
            foreach ($r in $e.Resources) {
                if ($r.ResourceName -eq $queueArn) {
                    $hasResource = $true
                    break
                }
            }
        }

        if (-not $hasResource) { continue }

        $records += [pscustomobject]@{
            EventTime = [DateTime]$e.EventTime
            EventName = $e.EventName
            Principal = $principal
            RawId     = $e.EventId
        }
    }
}

$principals = $records |
    Where-Object { $_.Principal } |
    Select-Object -ExpandProperty Principal -Unique

Write-Host "Found $($records.Count) CloudTrail events for the queue in the last $MinutesBack minutes."
Write-Host "Distinct principals: $(@($principals).Count)"
if ($principals) {
    $principals | Sort-Object | ForEach-Object { Write-Host "  - $_" }
} else {
    Write-Host "  (none)" -ForegroundColor DarkGray
}

# 4) Return a structured object for the verifier
[pscustomobject]@{
    QueueName             = $QueueName
    QueueUrl              = $queueUrl
    QueueArn              = $queueArn
    Principals            = @($principals)
    Events                = $records
    MissingOrInaccessible = $false
}
