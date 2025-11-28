param(
    [string]$Profile = 'lifebook-sso',
    [string]$Region  = 'us-east-1'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 1) Repo + AWS profile
if ($PSScriptRoot) {
    # Script mode: this file lives in infra/orchestrator
    $Repo = Resolve-Path (Join-Path $PSScriptRoot '..' '..')
} else {
    # REPL mode: assume you already cd'd into the repo root
    $Repo = Get-Location
}

Set-Location $Repo
Write-Host "== Lifebook-Site: $(Get-Location)" -ForegroundColor Cyan

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "aws CLI not found on PATH. Install AWS CLI v2 and re-run."
}

$Env:AWS_PROFILE = $Profile
$Env:AWS_REGION  = $Region
Write-Host "Using AWS_PROFILE=$($Env:AWS_PROFILE), AWS_REGION=$($Env:AWS_REGION)" -ForegroundColor Yellow

# 2) Load orchestrator env from .env.local
$EnvFile = Join-Path $Repo '.env.local'
if (-not (Test-Path $EnvFile)) {
    throw ".env.local not found at $EnvFile."
}

$envLines = Get-Content $EnvFile

function Get-EnvValueFromFile {
    param([string]$Name)

    $line = $envLines | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -First 1
    if (-not $line) {
        throw "$Name not found in .env.local"
    }

    $parts = $line -split '=', 2
    if ($parts.Length -lt 2) {
        throw "Unable to parse $Name from line: $line"
    }

    $val = $parts[1].Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or
        ($val.StartsWith("'") -and $val.EndsWith("'"))) {
        $val = $val.Substring(1, $val.Length - 2)
    }

    if (-not $val) {
        throw "$Name value in .env.local is empty"
    }

    return $val
}

$JobsTableName      = Get-EnvValueFromFile -Name 'JOBS_TABLE_NAME'
$RunLogsTableName   = Get-EnvValueFromFile -Name 'RUN_LOGS_TABLE_NAME'
$QueueUrl           = Get-EnvValueFromFile -Name 'ORCHESTRATOR_QUEUE_URL'

Write-Host ""
Write-Host "Orchestrator config from .env.local:" -ForegroundColor Yellow
Write-Host "  JOBS_TABLE_NAME       = $JobsTableName"
Write-Host "  RUN_LOGS_TABLE_NAME   = $RunLogsTableName"
Write-Host "  ORCHESTRATOR_QUEUE_URL= $QueueUrl"
Write-Host ""

# 3) Describe DynamoDB tables (sanity)
Write-Host "== Checking DynamoDB tables ==" -ForegroundColor Yellow

$jobsDescJson = aws dynamodb describe-table --table-name $JobsTableName --output json
if ($LASTEXITCODE -ne 0) { throw "describe-table failed for $JobsTableName" }
$jobsDesc = $jobsDescJson | ConvertFrom-Json

Write-Host "Jobs table:" -ForegroundColor Cyan
Write-Host ("  Name        : {0}" -f $jobsDesc.Table.TableName)
Write-Host ("  ItemCount   : {0}" -f $jobsDesc.Table.ItemCount)
Write-Host ("  KeySchema   : {0}" -f (($jobsDesc.Table.KeySchema | ForEach-Object { "$($_.AttributeName) [$($_.KeyType)]" }) -join ', '))
Write-Host ""

$runLogsDescJson = aws dynamodb describe-table --table-name $RunLogsTableName --output json
if ($LASTEXITCODE -ne 0) { throw "describe-table failed for $RunLogsTableName" }
$runLogsDesc = $runLogsDescJson | ConvertFrom-Json

Write-Host "Run-logs table:" -ForegroundColor Cyan
Write-Host ("  Name        : {0}" -f $runLogsDesc.Table.TableName)
Write-Host ("  ItemCount   : {0}" -f $runLogsDesc.Table.ItemCount)
Write-Host ("  KeySchema   : {0}" -f (($runLogsDesc.Table.KeySchema | ForEach-Object { "$($_.AttributeName) [$($_.KeyType)]" }) -join ', '))
Write-Host ""

# 4) Check SQS queue attributes (robust)
Write-Host "== Checking SQS queue ==" -ForegroundColor Yellow
$attrsJson = aws sqs get-queue-attributes `
    --queue-url $QueueUrl `
    --attribute-names All `
    --output json

if ($LASTEXITCODE -ne 0) {
    throw "get-queue-attributes failed for $QueueUrl"
}

$attrs     = $attrsJson | ConvertFrom-Json
$attrProps = $attrs.Attributes

Write-Host "Queue attributes:" -ForegroundColor Cyan

$attrKeysToShow = @(
    'VisibilityTimeout',
    'MessageRetentionPeriod',
    'RedrivePolicy',
    'FifoQueue',
    'ContentBasedDeduplication'
)

$present = @()
foreach ($k in $attrKeysToShow) {
    if ($attrProps.PSObject.Properties.Name -contains $k) {
        $present += $k
        Write-Host ("  {0} = {1}" -f $k, $attrProps.$k)
    }
}

if (-not $present) {
    Write-Host "  (none of the requested attributes were present)" -ForegroundColor DarkYellow
}
Write-Host ""

# 5) SQS send/receive smoke test (robust)
Write-Host "== SQS send/receive smoke test ==" -ForegroundColor Yellow

$testBody = "lifebook-orchestrator-smoke-" + ([Guid]::NewGuid().ToString())
$dedupId  = "dedup-" + ([Guid]::NewGuid().ToString())
$groupId  = "orchestrator-smoke"

$sendArgs = @(
    'sqs','send-message',
    '--queue-url', $QueueUrl,
    '--message-body', $testBody
)

# Only include FIFO args if the URL looks like a FIFO queue
if ($QueueUrl -like '*fifo*') {
    $sendArgs += @(
        '--message-group-id', $groupId,
        '--message-deduplication-id', $dedupId
    )
}

$sendJson = aws @sendArgs --output json
if ($LASTEXITCODE -ne 0) {
    throw "send-message failed"
}
$send = $sendJson | ConvertFrom-Json
Write-Host ("Sent test message. MessageId={0}" -f $send.MessageId) -ForegroundColor Green

# Try to receive it back (short wait)
$recvJson = aws sqs receive-message `
    --queue-url $QueueUrl `
    --max-number-of-messages 1 `
    --wait-time-seconds 5 `
    --output json

if ($LASTEXITCODE -ne 0) {
    throw "receive-message failed"
}

# Handle completely empty / whitespace JSON safely
if (-not $recvJson -or -not $recvJson.Trim()) {
    $recv = $null
} else {
    $recv = $recvJson | ConvertFrom-Json
}

# Detect whether a Messages property exists without throwing
$hasMessagesProp = $false
if ($null -ne $recv) {
    $member = $recv | Get-Member -Name Messages -ErrorAction SilentlyContinue
    if ($null -ne $member) {
        $hasMessagesProp = $true
    }
}

if ($hasMessagesProp -and $recv.Messages -and $recv.Messages.Count -gt 0) {
    $msg = $recv.Messages[0]
    Write-Host ("Received message: MessageId={0}" -f $msg.MessageId) -ForegroundColor Green
    Write-Host ("  Body = {0}" -f $msg.Body)

    aws sqs delete-message --queue-url $QueueUrl --receipt-handle $msg.ReceiptHandle | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Deleted test message from queue." -ForegroundColor Green
    } else {
        Write-Host "WARN: Failed to delete test message, please check queue manually." -ForegroundColor Yellow
    }
} else {
    Write-Host "No messages received in 5 seconds. Queue is reachable; worker may have consumed the message." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "DynamoDB jobs + run-logs + SQS queue all look healthy from this dev shell." -ForegroundColor Green
