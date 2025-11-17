param(
    [string]$QueueName   = 'lifebook-orchestrator-queue',
    [int]   $MinutesBack = 60,
    [string]$Profile     = 'lifebook-sso',
    [string]$Region      = 'us-east-1'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host "who-touched-queue.ps1" -ForegroundColor Cyan
Write-Host "  Profile     : $Profile"
Write-Host "  Region      : $Region"
Write-Host "  QueueName   : $QueueName"
Write-Host "  MinutesBack : $MinutesBack"
Write-Host ""

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
        return $out | ConvertFrom-Json
    } catch {
        return $out
    }
}

# 1) Resolve queue URL
try {
    $urlResp  = Invoke-Aws sqs get-queue-url --queue-name $QueueName --profile $Profile --region $Region
    $queueUrl = $urlResp.QueueUrl
} catch {
    Write-Warning "Queue '$QueueName' not found or not accessible in region '$Region' for profile '$Profile'."
    return [pscustomobject]@{
        QueueName            = $QueueName
        QueueUrl             = $null
        QueueArn             = $null
        MissingOrInaccessible = $true
        Principals           = @()
    }
}

# 2) Resolve queue ARN
$attrResp = Invoke-Aws sqs get-queue-attributes --queue-url $queueUrl --attribute-names QueueArn --profile $Profile --region $Region
$queueArn = $attrResp.Attributes.QueueArn

Write-Host "  QueueUrl : $queueUrl"
Write-Host "  QueueArn : $queueArn"
Write-Host ""

# 3) Compute time window for CloudTrail lookup
$end   = (Get-Date).ToUniversalTime()
$start = $end.AddMinutes(-$MinutesBack)

$startIso = $start.ToString('o')
$endIso   = $end.ToString('o')

Write-Host "Querying CloudTrail from $startIso to $endIso ..." -ForegroundColor Yellow

# NOTE: Each LookupAttributes struct must be a single token:
#   "AttributeKey=ResourceName,AttributeValue=<ARN>"
$lookupArgs = @(
    'cloudtrail', 'lookup-events',
    '--lookup-attributes', "AttributeKey=ResourceName,AttributeValue=$queueArn",
    '--start-time', $startIso,
    '--end-time',   $endIso,
    '--max-results', '50',
    '--profile', $Profile,
    '--region',  $Region
)

$resp = Invoke-Aws @lookupArgs

$events = @()
if ($resp.Events) {
    $events = @($resp.Events)
}

# 4) Collect principals (UserName) from CloudTrail events
$principals = @()
foreach ($ev in $events) {
    if ($ev.Username) {
        $principals += $ev.Username
    }
}

$principals = $principals | Where-Object { $_ } | Sort-Object -Unique

if (-not $principals -or $principals.Count -eq 0) {
    Write-Host "No CloudTrail principals found for '$QueueName' in the last $MinutesBack minutes." -ForegroundColor Yellow
} else {
    Write-Host "Principals found in CloudTrail for '$QueueName':" -ForegroundColor Cyan
    $principals | ForEach-Object { Write-Host "  - $_" }
}

# 5) Return structured object expected by verify-orchestrator-queue.ps1
return [pscustomobject]@{
    QueueName            = $QueueName
    QueueUrl             = $queueUrl
    QueueArn             = $queueArn
    MissingOrInaccessible = $false
    Principals           = $principals
}
