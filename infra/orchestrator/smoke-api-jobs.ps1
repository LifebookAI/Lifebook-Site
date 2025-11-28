param(
    [string]$BaseUrl      = 'http://localhost:3000',
    [string]$WorkflowSlug = 'sample_hello_world'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host "=== api-jobs smoke ==="
Write-Host "BaseUrl: $BaseUrl"

# Normalize BaseUrl (no trailing slash)
if ($BaseUrl.EndsWith('/')) {
    $BaseUrl = $BaseUrl.TrimEnd('/')
}

# 1) POST /api/jobs to create a job
$clientRequestId = [Guid]::NewGuid().ToString()
Write-Host ("POST /api/jobs with workflowSlug='{0}' and clientRequestId='{1}'" -f $WorkflowSlug, $clientRequestId)

$bodyObj = @{
    workflowSlug    = $WorkflowSlug
    clientRequestId = $clientRequestId
    input           = @{
        source = 'smoke-api-jobs.ps1'
    }
}

$bodyJson = $bodyObj | ConvertTo-Json -Depth 6

try {
    $createResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/jobs" -ContentType 'application/json' -Body $bodyJson
} catch {
    throw ("POST /api/jobs failed: {0}" -f $_.Exception.Message)
}

if (-not $createResponse -or -not $createResponse.job) {
    throw "POST /api/jobs did not return a 'job' object in the response."
}

$job = $createResponse.job

# Support either jobId or id
$jobId = $null
if ($job.PSObject.Properties.Name -contains 'jobId') {
    $jobId = $job.jobId
} elseif ($job.PSObject.Properties.Name -contains 'id') {
    $jobId = $job.id
}

if (-not $jobId) {
    throw "Response.job did not contain a 'jobId' or 'id' field."
}

$initialStatus = $job.status
if (-not $initialStatus) { $initialStatus = '<unknown>' }

Write-Host ("Created jobId: {0} with initial status: '{1}'" -f $jobId, $initialStatus)

# 2) Poll GET /api/jobs?jobId=... for a few seconds
$maxPolls         = 5
$pollDelaySeconds = 1
$finalJob         = $null

for ($i = 1; $i -le $maxPolls; $i++) {
    Start-Sleep -Seconds $pollDelaySeconds

    $pollUrl = "$BaseUrl/api/jobs?jobId=$jobId"

    try {
        $pollResponse = Invoke-RestMethod -Method Get -Uri $pollUrl
    } catch {
        Write-Warning ("Poll {0}/{1}: GET {2} failed: {3}" -f $i, $maxPolls, $pollUrl, $_.Exception.Message)
        continue
    }

    if ($pollResponse -and $pollResponse.job) {
        $finalJob = $pollResponse.job
        $status   = $finalJob.status
        if (-not $status) { $status = '<unknown>' }

        Write-Host ("Poll {0}/{1}: status='{2}'" -f $i, $maxPolls, $status)

        # For now, accept any status once we see the job object come back
        if ($status -in @('queued', 'running', 'completed', 'failed')) {
            break
        }
    } else {
        Write-Warning ("Poll {0}/{1}: response did not contain a 'job' object." -f $i, $maxPolls)
    }
}

if (-not $finalJob) {
    throw ("GET /api/jobs?jobId={0} never returned a 'job' object after {1} polls." -f $jobId, $maxPolls)
}

$finalStatus = $finalJob.status
if (-not $finalStatus) { $finalStatus = '<unknown>' }

Write-Host ("Final job status after polling: '{0}'" -f $finalStatus)

# 3) Best-effort GET with logs (non-fatal)
$logsUrl = "$BaseUrl/api/jobs?jobId=$jobId&includeLogs=true"
Write-Host ("GET (with logs) {0}" -f $logsUrl)

$getWithLogs = $null
try {
    $getWithLogs = Invoke-RestMethod -Method Get -Uri $logsUrl
} catch {
    Write-Warning ("GET with logs failed (non-fatal): {0}" -f $_.Exception.Message)
}

if ($null -ne $getWithLogs) {
    $hasJobProp  = $false
    $hasLogsProp = $false

    $memberJob = $getWithLogs | Get-Member -Name job -ErrorAction SilentlyContinue
    if ($null -ne $memberJob) { $hasJobProp = $true }

    $memberLogs = $getWithLogs | Get-Member -Name logs -ErrorAction SilentlyContinue
    if ($null -ne $memberLogs -and $getWithLogs.logs) { $hasLogsProp = $true }

    if ($hasJobProp) {
        $logsStatus = $getWithLogs.job.status
        if (-not $logsStatus) { $logsStatus = '<unknown>' }
        Write-Host ("Logs response includes job; status='{0}'." -f $logsStatus)
    } else {
        Write-Warning "Logs response did not contain a 'job' property (non-fatal)."
    }

    if ($hasLogsProp) {
        $count = $getWithLogs.logs.Count
        Write-Host ("Logs array present with {0} record(s)." -f $count)
    } else {
        Write-Warning "No 'logs' array found in logs response (non-fatal)."
    }
} else {
    Write-Warning "No logs payload returned (non-fatal)."
}

Write-Host "api-jobs smoke completed." -ForegroundColor Green
