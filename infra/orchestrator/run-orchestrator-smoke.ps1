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

Write-Host "run-orchestrator-smoke.ps1 — profile=$Profile region=$Region baseUrl=$BaseUrl" -ForegroundColor Cyan

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$checkScript = Join-Path $scriptRoot 'check-orchestrator-aws.ps1'
$e2eScript   = Join-Path $scriptRoot 'smoke-orchestrator-e2e.ps1'

if (-not (Test-Path $checkScript)) {
    throw "Missing orchestrator check script: $checkScript"
}
if (-not (Test-Path $e2eScript)) {
    throw "Missing orchestrator E2E script: $e2eScript"
}

Write-Host "`n[1/2] Checking orchestrator AWS plumbing (DDB tables, queue, DLQ, redrive)..." -ForegroundColor Yellow
$awsCheck = & $checkScript -Profile $Profile -Region $Region
Write-Host "[1/2] AWS orchestrator check completed." -ForegroundColor Green

Write-Host "`n[2/2] Running E2E orchestrator smoke (/api/jobs → DynamoDB → S3)..." -ForegroundColor Yellow
$e2e = & $e2eScript `
    -Profile $Profile `
    -Region $Region `
    -Bucket $Bucket `
    -BaseUrl $BaseUrl `
    -TimeoutSeconds $TimeoutSeconds `
    -PollIntervalSeconds $PollIntervalSeconds

Write-Host "`nOrchestrator smoke wrapper PASSED." -ForegroundColor Green
Write-Host "JobId: $($e2e.JobId)  Status: $($e2e.Status)  S3: s3://$($e2e.Bucket)/$($e2e.S3Key)" -ForegroundColor DarkCyan

# Return a combined object for CI / callers
[PSCustomObject]@{
    AwsCheck = $awsCheck
    E2E      = $e2e
}
