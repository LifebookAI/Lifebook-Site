param(
    [Parameter(Mandatory = $false)]
    [string]$WorkflowSlug = "sample_hello_world",

    [Parameter(Mandatory = $false)]
    [string]$BaseUrl,

    [Parameter(Mandatory = $false)]
    [int]$PollSeconds = 2,

    [Parameter(Mandatory = $false)]
    [int]$MaxSeconds = 60,

    [switch]$IncludeLogs
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $BaseUrl -or -not $BaseUrl.Trim()) {
    if ($env:LFLBK_API_BASE_URL -and $env:LFLBK_API_BASE_URL.Trim()) {
        $BaseUrl = $env:LFLBK_API_BASE_URL
    }
    else {
        $BaseUrl = "http://localhost:3000"
    }
}

if ($PollSeconds -le 0) { $PollSeconds = 2 }
if ($MaxSeconds -le 0) { $MaxSeconds = 60 }

$includeLogsParam = if ($IncludeLogs) { "true" } else { "false" }

Write-Host "run-job-and-wait.ps1 - workflowSlug=$WorkflowSlug baseUrl=$BaseUrl includeLogs=$includeLogsParam poll=${PollSeconds}s max=${MaxSeconds}s" -ForegroundColor Cyan

# 1) POST /api/jobs to create a new job
$postUri = "$($BaseUrl.TrimEnd('/'))/api/jobs"
Write-Host "POST $postUri ..." -ForegroundColor Yellow

$bodyObject = @{
    workflowSlug = $WorkflowSlug
    input = @{
        from = "cli-runner"
        note = "triggered from infra/orchestrator/run-job-and-wait.ps1"
    }
}

$bodyJson = $bodyObject | ConvertTo-Json -Depth 6

try {
    $postResp = Invoke-RestMethod -Uri $postUri -Method Post -Body $bodyJson -ContentType "application/json"
}
catch {
    Write-Host "POST /api/jobs failed: $($_.Exception.Message)" -ForegroundColor Red
    throw
}

if (-not $postResp.ok) {
    Write-Host "`nAPI reported error creating job:" -ForegroundColor Red
    $postResp | ConvertTo-Json -Depth 8 | Write-Host
    exit 1
}

$job = $postResp.job
if (-not $job) {
    Write-Host "`nNo job object in POST response. Raw:" -ForegroundColor Red
    $postResp | ConvertTo-Json -Depth 8 | Write-Host
    exit 1
}

$jobId = $job.jobId
Write-Host "`nCreated jobId: $jobId (status=$($job.status))" -ForegroundColor Green

$finalStatuses = @("succeeded", "failed", "cancelled")
$elapsed = 0

# 2) Poll GET /api/jobs until final or timeout
while ($elapsed -lt $MaxSeconds) {
    if ($finalStatuses -contains $job.status) {
        break
    }

    Start-Sleep -Seconds $PollSeconds
    $elapsed += $PollSeconds

    $getUri = "$($BaseUrl.TrimEnd('/'))/api/jobs?jobId=$jobId&includeLogs=$includeLogsParam"
    Write-Host "Polling ($elapsed s) GET $getUri ..." -ForegroundColor DarkCyan

    try {
        $getResp = Invoke-RestMethod -Uri $getUri -Method Get
    }
    catch {
        Write-Host "GET /api/jobs failed: $($_.Exception.Message)" -ForegroundColor Red
        break
    }

    if (-not $getResp.ok) {
        Write-Host "API reported error while polling:" -ForegroundColor Red
        $getResp | ConvertTo-Json -Depth 8 | Write-Host
        break
    }

    if ($getResp.job) {
        $job = $getResp.job
    }

    Write-Host "  -> status=$($job.status)" -ForegroundColor Gray

    if ($finalStatuses -contains $job.status) {
        if ($IncludeLogs) {
            $logs = $getResp.logs
            $count = if ($logs) { $logs.Count } else { 0 }
            Write-Host "`nLogs (count=$count):" -ForegroundColor Green

            if (-not $logs -or $logs.Count -eq 0) {
                Write-Host "(no logs returned)" -ForegroundColor DarkYellow
            }
            else {
                foreach ($log in $logs) {
                    $createdAt = $log.createdAt
                    $level     = if ($log.PSObject.Properties.Name -contains "level" -and $log.level) { $log.level } else { "info" }
                    $message   = if ($log.PSObject.Properties.Name -contains "message") { $log.message } else { "" }
                    "{0} [{1}] {2}" -f $createdAt, $level, $message
                }
            }
        }

        break
    }
}

Write-Host "`nFinal job state:" -ForegroundColor Cyan
"{0,-20} {1}" -f "jobId",           $job.jobId
"{0,-20} {1}" -f "workflowSlug",    $job.workflowSlug
"{0,-20} {1}" -f "status",          $job.status
"{0,-20} {1}" -f "clientRequestId", $job.clientRequestId

$inputJson = $null
try { $inputJson = $job.input | ConvertTo-Json -Depth 5 -Compress } catch { $inputJson = "<unserializable>" }
"{0,-20} {1}" -f "input",          $inputJson

if (-not ($finalStatuses -contains $job.status)) {
    Write-Host "`nWARNING: job did not reach a final status within $MaxSeconds seconds." -ForegroundColor Yellow
    exit 1
}
