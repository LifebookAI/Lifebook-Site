param(
    [string]$Region  = $env:AWS_REGION,
    [string]$Profile = $env:AWS_PROFILE,
    [string]$JobId   = $null
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Region)  { $Region  = "us-east-1" }
if (-not $Profile) { $Profile = "lifebook-sso" }

Write-Host ("Using profile '{0}' in region '{1}' for direct orchestrator-worker invoke..." -f $Profile, $Region) -ForegroundColor Cyan

# Resolve repo root
try {
    $repoRoot = (git rev-parse --show-toplevel).Trim()
} catch {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

# If JobId not provided, pull latest orchestrator_e2e.synthetic_smoke from state/build-checkpoints.json
if (-not $JobId) {
    $cpFile = Join-Path $repoRoot "state/build-checkpoints.json"
    if (-not (Test-Path $cpFile)) {
        throw "Checkpoint file not found at $cpFile and no -JobId provided."
    }

    $raw = Get-Content $cpFile -Raw
    if (-not $raw.Trim()) {
        throw "Checkpoint file is empty and no -JobId provided."
    }

    $all = $raw | ConvertFrom-Json

    # Treat single object or array uniformly
    if (-not ($all -is [System.Collections.IEnumerable] -and -not ($all -is [string]))) {
        $all = @($all)
    }

    # Only keep entries that actually have area+step
    $withAreaStep = $all | Where-Object {
        $_.PSObject.Properties.Name -contains 'area' -and
        $_.PSObject.Properties.Name -contains 'step'
    }

    if (-not $withAreaStep -or $withAreaStep.Count -eq 0) {
        throw "No checkpoint entries with 'area' and 'step' found in $cpFile and no -JobId provided."
    }

    $latest = $withAreaStep |
        Where-Object { $_.area -eq 'orchestrator_e2e' -and $_.step -eq 'synthetic_smoke' } |
        Select-Object -Last 1

    if (-not $latest) {
        throw "No orchestrator_e2e.synthetic_smoke checkpoint found and no -JobId provided."
    }

    $JobId = $latest.details.job_id
}

if (-not $JobId) {
    throw "JobId could not be resolved."
}

Write-Host ("Using JobId = {0}" -f $JobId) -ForegroundColor Green

# Build inner body JSON (same shape as DLQ message you saw)
$bodyObj = [pscustomobject]@{
    idemKey = ("synthetic-{0}" -f [guid]::NewGuid().ToString())
    inputs  = @{
        url = "https://example.com"
    }
    jobId   = $JobId
    outputs = @{
        s3Out = @{
            bucket = "lifebook.ai"
            key    = ("workflows/manual/{0}.md" -f $JobId)
        }
    }
}
$bodyJson = $bodyObj | ConvertTo-Json -Depth 6

# Build SQS-style event wrapper
$record = [pscustomobject]@{
    messageId         = ("synthetic-" + [guid]::NewGuid().ToString())
    receiptHandle     = "synthetic"
    body              = $bodyJson
    attributes        = @{}
    messageAttributes = @{}
    md5OfBody         = ""
    eventSource       = "aws:sqs"
    eventSourceARN    = ("arn:aws:sqs:{0}:354630286254:lifebook-orchestrator-queue" -f $Region)
    awsRegion         = $Region
}

$event = @{ Records = @($record) }
$payloadJson = $event | ConvertTo-Json -Depth 10

Write-Host "`nInvoking lifebook-orchestrator-worker with synthetic SQS event..." -ForegroundColor Cyan

# We must provide an outfile for aws lambda invoke; use a temp file and then delete it.
$tmpOut = [System.IO.Path]::GetTempFileName()

$logB64 = aws lambda invoke `
    --function-name lifebook-orchestrator-worker `
    --payload $payloadJson `
    --cli-binary-format raw-in-base64-out `
    --log-type Tail `
    --region $Region `
    --profile $Profile `
    --query 'LogResult' `
    --output text `
    $tmpOut

$exit = $LASTEXITCODE

# Best-effort cleanup of temp file
try { Remove-Item $tmpOut -ErrorAction SilentlyContinue } catch { }

if ($exit -ne 0) {
    throw "aws lambda invoke failed with exit code $exit"
}

Write-Host "`nLambda logs (from invoke response):" -ForegroundColor Green
if ($logB64 -and $logB64 -ne 'None') {
    try {
        $bytes   = [System.Convert]::FromBase64String($logB64)
        $logText = [System.Text.Encoding]::UTF8.GetString($bytes)
        $logText
    } catch {
        Write-Host "<failed to decode LogResult: $($_.Exception.Message)>" -ForegroundColor Yellow
    }
} else {
    Write-Host "<no LogResult returned>" -ForegroundColor Yellow
}

# Re-read job record from DynamoDB
Write-Host "`nReloading job record from DynamoDB for jobId=$JobId..." -ForegroundColor Cyan
$keyObj = @{
    pk = @{ S = $JobId }
    sk = @{ S = "job" }
}
$keyJson = $keyObj | ConvertTo-Json -Depth 5

$resp = aws dynamodb get-item `
    --table-name lifebook-orchestrator-jobs `
    --key $keyJson `
    --region $Region `
    --profile $Profile `
    --output json | ConvertFrom-Json

if (-not $resp.Item) {
    Write-Host "No job item found after Lambda invoke." -ForegroundColor Yellow
    return
}

$item = $resp.Item
$status   = if ($item.status)       { $item.status.S }            else { $null }
$attempts = if ($item.attempts)     { [int]$item.attempts.N }     else { $null }
$maxAtt   = if ($item.max_attempts) { [int]$item.max_attempts.N } else { $null }
$lastCode = if ($item.last_error_code) {
                if ($item.last_error_code.NULL) { $null } else { $item.last_error_code.S }
            } else { $null }
$lastMsg  = if ($item.last_error_message) {
                if ($item.last_error_message.NULL) { $null } else { $item.last_error_message.S }
            } else { $null }

[pscustomobject]@{
    job_id          = $JobId
    status          = $status
    attempts        = $attempts
    max_attempts    = $maxAtt
    last_error_code = $lastCode
    last_error_msg  = $lastMsg
}
