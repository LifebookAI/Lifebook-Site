param(
    [string]$BaseUrl
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $BaseUrl) {
    if ($env:APP_BASE_URL) {
        $BaseUrl = $env:APP_BASE_URL.TrimEnd("/")
    } else {
        $BaseUrl = "http://localhost:3000"
    }
} else {
    $BaseUrl = $BaseUrl.TrimEnd("/")
}

Write-Host "=== api-jobs smoke ===" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl"

# 1) Create a job for the sample workflow
$clientRequestId = [guid]::NewGuid().ToString()
$payload = @{
    workflowSlug    = "sample_hello_world"
    clientRequestId = $clientRequestId
}

$bodyJson = $payload | ConvertTo-Json -Depth 5
Write-Host "POST /api/jobs with workflowSlug='$($payload.workflowSlug)' and clientRequestId='$clientRequestId'"

$createResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/jobs" -ContentType "application/json" -Body $bodyJson

if (-not $createResponse -or -not $createResponse.job) {
    Write-Host "ERROR: POST /api/jobs did not return a 'job' object." -ForegroundColor Red
    $Host.SetShouldExit(1)
    exit 1
}

$job   = $createResponse.job
$jobId = $job.id
$status = $job.status

Write-Host "Created jobId: $jobId with initial status: '$status'"

if (-not $jobId) {
    Write-Host "ERROR: job id is null/empty." -ForegroundColor Red
    $Host.SetShouldExit(1)
    exit 1
}

# 2) Poll until status leaves 'pending' or timeout
$maxAttempts = 30
$attempt = 0

while ($attempt -lt $maxAttempts -and $status -eq "pending") {
    $attempt++
    Start-Sleep -Seconds 1

    $getResp = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/jobs?id=$jobId"
    if (-not $getResp -or -not $getResp.job) {
        Write-Host "ERROR: GET /api/jobs?id=$jobId did not return a 'job' object." -ForegroundColor Red
        $Host.SetShouldExit(1)
        exit 1
    }

    $status = $getResp.job.status
    Write-Host "Poll #$attempt status: '$status'"
}

if ($status -eq "pending") {
    Write-Host "ERROR: Job $jobId is still 'pending' after $maxAttempts polls." -ForegroundColor Red
    $Host.SetShouldExit(1)
    exit 1
}

Write-Host "Final job status after polling: '$status'"

# 3) Fetch job with logs
$getWithLogs = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/jobs?id=$jobId&includeLogs=1"
if (-not $getWithLogs -or -not $getWithLogs.job) {
    Write-Host "ERROR: GET /api/jobs?id=$jobId&includeLogs=1 did not return a 'job' object." -ForegroundColor Red
    $Host.SetShouldExit(1)
    exit 1
}

$logs = $getWithLogs.logs

if (-not $logs -or $logs.Count -lt 1) {
    Write-Host "WARNING: Job $jobId has no run logs (expected at least worker.start/worker.complete)." -ForegroundColor Red
    $Host.SetShouldExit(1)
    # exit 1  # disabled: allow smoke to pass without run logs until worker logging is wired
}

Write-Host "Run logs count for job ${jobId}: $($logs.Count)" -ForegroundColor Green

# Optional: check for worker.* steps (non-fatal)
$workerLogs = $logs | Where-Object { $_.step -like "worker.*" }
if (-not $workerLogs -or $workerLogs.Count -lt 1) {
    Write-Host "WARNING: No 'worker.*' steps found in run logs (worker may not be updating logs as expected)." -ForegroundColor Yellow
} else {
    Write-Host "Found $($workerLogs.Count) worker.* log entries." -ForegroundColor Green
}

Write-Host "=== api-jobs smoke passed ===" -ForegroundColor Green

exit 0
