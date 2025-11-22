param(
    [string]$Region      = $env:AWS_REGION,
    [string]$Profile     = $env:AWS_PROFILE,
    [string]$WorkspaceId = "ws_synthetic_smoke",
    [string]$UserId      = "user_synthetic_smoke",
    [string]$WorkflowId  = "wf_synthetic_orchestrator_smoke",
    [string]$TriggerType = "manual"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not $Region)  { $Region  = "us-east-1" }
if (-not $Profile) { $Profile = "lifebook-sso" }

Write-Host "Using AWS profile '$Profile' in region '$Region'..." -ForegroundColor Cyan

# --- AWS CLI helper (token-array) ---
function Invoke-AwsCli {
    param(
        [Parameter(Mandatory)][string[]]$Args,
        [switch]$AsJson
    )
    $allArgs = @($Args + @("--region", $Region, "--profile", $Profile))
    Write-Verbose ("Running: aws " + ($allArgs -join ' '))
    $output = & aws @allArgs
    if ($LASTEXITCODE -ne 0) {
        throw "AWS CLI failed ($LASTEXITCODE): aws $($Args -join ' ')"
    }
    if ($AsJson) {
        if (-not $output) { return $null }
        return $output | ConvertFrom-Json
    }
    return $output
}

$tableName = 'lifebook-orchestrator-jobs'
$queueName = 'lifebook-orchestrator-queue'

Write-Host "Resolving SQS queue '$queueName'..." -ForegroundColor Cyan
$queueUrlJson = Invoke-AwsCli -Args @("sqs","get-queue-url","--queue-name",$queueName) -AsJson
$queueUrl     = $queueUrlJson.QueueUrl
Write-Host "Queue URL: $queueUrl" -ForegroundColor Green

# --- Build job record ---
$nowUtc   = (Get-Date).ToUniversalTime()
$ttlDays  = 30
$ttlUtc   = $nowUtc.AddDays($ttlDays)
$ttlEpoch = [int64]($ttlUtc - [datetime]::UnixEpoch).TotalSeconds

$jobGuid = [guid]::NewGuid().ToString("N")
$jobId   = "job-" + $jobGuid

# FIXED: use ${WorkspaceId}/${WorkflowId} so ':' is not parsed into the variable name
$idempotencyKey = "synthetic:${WorkspaceId}:${WorkflowId}:$($nowUtc.ToString('yyyyMMddTHHmmssZ'))"

Write-Host "Creating synthetic job '$jobId' in table '$tableName'..." -ForegroundColor Cyan

# IMPORTANT: pk + sk (table has composite key)
# Contract: pk = job_id, sk = "job" for the root job record
$item = @{
    pk               = @{ S = $jobId }    # partition key
    sk               = @{ S = "job" }     # sort key for the main job record
    job_id           = @{ S = $jobId }
    workspace_id     = @{ S = $WorkspaceId }
    user_id          = @{ S = $UserId }
    workflow_id      = @{ S = $WorkflowId }
    trigger_type     = @{ S = $TriggerType }
    status           = @{ S = "queued" }
    attempts         = @{ N = "0" }
    max_attempts     = @{ N = "5" }
    step_cursor      = @{ N = "0" }
    steps_total      = @{ N = "1" }
    credits_estimate = @{ N = "1" }
    credits_reserved = @{ N = "1" }
    credits_spent    = @{ N = "0" }
    idempotency_key  = @{ S = $idempotencyKey }
    last_error_code    = @{ NULL = $true }
    last_error_message = @{ NULL = $true }
    created_at       = @{ S = $nowUtc.ToString("o") }
    updated_at       = @{ S = $nowUtc.ToString("o") }
    started_at       = @{ NULL = $true }
    completed_at     = @{ NULL = $true }
    ttl_at           = @{ N = $ttlEpoch.ToString() }
}

$putReq = @{
    TableName = $tableName
    Item      = $item
}

$putJson = $putReq | ConvertTo-Json -Depth 10
Invoke-AwsCli -Args @("dynamodb","put-item","--cli-input-json",$putJson) | Out-Null
Write-Host "DynamoDB put-item succeeded for job_id=$jobId." -ForegroundColor Green

# --- Build SQS payload matching the v1 contract ---
$payload = @{
    v               = 1
    job_id          = $jobId
    workspace_id    = $WorkspaceId
    trigger_type    = $TriggerType
    attempt         = 1
    max_attempts    = 5
    trace_id        = "synthetic-" + ([guid]::NewGuid().ToString("N"))
    idempotency_key = $idempotencyKey
}

$body = $payload | ConvertTo-Json -Depth 5

Write-Host "Sending SQS message for job '$jobId'..." -ForegroundColor Cyan

Invoke-AwsCli -Args @(
    "sqs","send-message",
    "--queue-url",$queueUrl,
    "--message-body",$body
) | Out-Null

Write-Host "`nSynthetic orchestrator job created and enqueued." -ForegroundColor Green
Write-Host "job_id      : $jobId"       -ForegroundColor Cyan
Write-Host "workspace_id: $WorkspaceId" -ForegroundColor Cyan
Write-Host "workflow_id : $WorkflowId"  -ForegroundColor Cyan

# --- Optional: append a checkpoint to state/build-checkpoints.json ---
try {
    $repoRoot = (git rev-parse --show-toplevel).Trim()
} catch {
    $repoRoot = $PSScriptRoot
}

$cpFile = Join-Path $repoRoot 'state/build-checkpoints.json'
$list   = @()

if (Test-Path $cpFile) {
    $raw = Get-Content $cpFile -Raw
    if ($raw.Trim()) {
        $existingCp = $raw | ConvertFrom-Json
        if ($existingCp -is [System.Collections.IEnumerable] -and -not ($existingCp -is [string])) {
            $list = @($existingCp)
        } else {
            $list = @($existingCp)
        }
    }
}

$checkpoint = [pscustomobject]@{
    timestamp = (Get-Date).ToString("s")
    area      = 'orchestrator_synthetic'
    step      = 'job_created_and_enqueued'
    status    = 'ok'
    details   = [pscustomobject]@{
        profile     = $Profile
        region      = $Region
        tableName   = $tableName
        queueName   = $queueName
        jobId       = $jobId
        workspaceId = $WorkspaceId
        workflowId  = $WorkflowId
        triggerType = $TriggerType
    }
}

$list = @($list + $checkpoint)
$list | ConvertTo-Json -Depth 6 | Set-Content -Path $cpFile -Encoding utf8

Write-Host "Checkpoint (orchestrator_synthetic.job_created_and_enqueued) appended to state/build-checkpoints.json" -ForegroundColor Green
