param(
    [string]$Profile = $(if ($env:AWS_PROFILE -and $env:AWS_PROFILE.Trim()) { $env:AWS_PROFILE } else { 'lifebook-sso' }),
    [string]$Region  = 'us-east-1',
    [string]$Bucket  = 'lifebook.ai',
    [string]$BaseUrl = $(if ($env:LFLBK_API_BASE_URL -and $env:LFLBK_API_BASE_URL.Trim()) { $env:LFLBK_API_BASE_URL } else { 'http://localhost:3000' }),
    [int]$TimeoutSeconds = 60,
    [int]$PollIntervalSeconds = 3
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host "Orchestrator E2E smoke — profile=$Profile region=$Region baseUrl=$BaseUrl" -ForegroundColor Cyan

function Get-OrchestratorJobFromDdb {
    param(
        [Parameter(Mandatory = $true)][string]$JobId,
        [Parameter(Mandatory = $true)][string]$Profile,
        [Parameter(Mandatory = $true)][string]$Region
    )

    $tableName = 'lifebook-orchestrator-jobs'

    $shapes = @(
        @{ Name = 'job_id'; Key = @{ job_id = @{ S = $JobId } } },
        @{ Name = 'jobId';  Key = @{ jobId  = @{ S = $JobId } } },
        @{ Name = 'pk_sk';  Key = @{ pk     = @{ S = $JobId }; sk = @{ S = 'job' } } }
    )

    foreach ($shape in $shapes) {
        $keyJson = $shape.Key | ConvertTo-Json -Compress

        $json = aws dynamodb get-item `
            --table-name $tableName `
            --key $keyJson `
            --profile $Profile `
            --region $Region `
            --output json 2>$null

        if (-not $json) { continue }

        $obj = $json | ConvertFrom-Json
        if ($obj.Item) {
            return [PSCustomObject]@{
                Shape = $shape.Name
                Item  = $obj.Item
            }
        }
    }

    return $null
}

# 1) POST /api/jobs with workflowSlug=sample_hello_world
$uri = "$($BaseUrl.TrimEnd('/'))/api/jobs"
$clientReqId = "e2e-$([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))"

$payloadObj = @{
    workflowSlug    = 'sample_hello_world'
    clientRequestId = $clientReqId
    input           = @{ foo = 'bar'; from = 'orchestrator-e2e' }
}
$payloadJson = $payloadObj | ConvertTo-Json -Depth 5

Write-Host "POST $uri ..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Method Post -Uri $uri -Body $payloadJson -ContentType 'application/json'
} catch {
    Write-Host "HTTP call to /api/jobs failed. Is the Next dev server running at $BaseUrl?" -ForegroundColor Red
    throw
}

if (-not $response.ok) {
    throw "API /api/jobs did not return ok=true. Raw: $($response | ConvertTo-Json -Depth 5)"
}

$job = $response.job
if (-not $job) {
    throw "API /api/jobs response missing 'job' object. Raw: $($response | ConvertTo-Json -Depth 5)"
}

$jobId = [string]$job.jobId
Write-Host "API returned jobId: $jobId; workflowSlug=$($job.workflowSlug); status=$($job.status)" -ForegroundColor Green

if (-not $jobId.StartsWith('job-')) {
    Write-Host "WARNING: jobId does not start with 'job-'; worker may treat it as manual-only." -ForegroundColor Yellow
}

# 2) Poll DynamoDB for job status until terminal
Write-Host "`nPolling DynamoDB for job status..." -ForegroundColor Yellow

$start  = Get-Date
$status = '<unknown>'
$result = $null

do {
    $result = Get-OrchestratorJobFromDdb -JobId $jobId -Profile $Profile -Region $Region

    if ($result -and $result.Item.status -and $result.Item.status.S) {
        $status = $result.Item.status.S
    } else {
        $status = '<unknown>'
    }

    Write-Host "Status poll: $status (shape=$($result.Shape))" -ForegroundColor DarkGray

    if ($status -in @('succeeded','failed','cancelled')) {
        break
    }

    Start-Sleep -Seconds $PollIntervalSeconds
} while ((Get-Date) -lt $start.AddSeconds($TimeoutSeconds))

if ($status -ne 'succeeded') {
    throw "Job $jobId did not reach 'succeeded' within $TimeoutSeconds seconds (final status: $status)."
}

Write-Host "Job $jobId reached status 'succeeded'." -ForegroundColor Green

# 3) Verify S3 result
$key = "workflows/manual/$jobId/result.md"
Write-Host "`nChecking S3 object s3://$Bucket/$key ..." -ForegroundColor Yellow

$headJson = aws s3api head-object `
    --bucket $Bucket `
    --key $key `
    --profile $Profile `
    --region $Region `
    --output json

$head = $headJson | ConvertFrom-Json

Write-Host "Found object. Size = $($head.ContentLength) bytes, LastModified = $($head.LastModified)" -ForegroundColor Green
Write-Host "SSE: $($head.ServerSideEncryption); KMSKeyId: $($head.SSEKMSKeyId)" -ForegroundColor DarkCyan

$tmp = Join-Path $env:TEMP "lf-orch-$($jobId).md"
aws s3 cp `
    "s3://$Bucket/$key" `
    $tmp `
    --profile $Profile `
    --region $Region `
    | Out-Null

Write-Host "`nDownloaded to: $tmp" -ForegroundColor Cyan
Write-Host "Preview (first 5 lines):" -ForegroundColor Yellow
Get-Content $tmp -TotalCount 5 | ForEach-Object { Write-Host $_ }

Write-Host "`nE2E orchestrator smoke PASSED: /api/jobs → DynamoDB → S3 for jobId $jobId" -ForegroundColor Cyan

# Return a simple object for callers/CI
[PSCustomObject]@{
    JobId   = $jobId
    Status  = $status
    S3Key   = $key
    Bucket  = $Bucket
    BaseUrl = $BaseUrl
}
