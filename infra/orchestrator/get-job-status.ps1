param(
    [Parameter(Mandatory = $false)]
    [string]$JobId,

    [Parameter(Mandatory = $false)]
    [string]$BaseUrl,

    [Parameter(Mandatory = $false)]
    [string]$Profile,

    [Parameter(Mandatory = $false)]
    [string]$Region = "us-east-1",

    [switch]$IncludeLogs
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Resolve defaults
if (-not $BaseUrl -or -not $BaseUrl.Trim()) {
    if ($env:LFLBK_API_BASE_URL -and $env:LFLBK_API_BASE_URL.Trim()) {
        $BaseUrl = $env:LFLBK_API_BASE_URL
    }
    else {
        $BaseUrl = "http://localhost:3000"
    }
}

if (-not $Profile -or -not $Profile.Trim()) {
    if ($env:AWS_PROFILE -and $env:AWS_PROFILE.Trim()) {
        $Profile = $env:AWS_PROFILE
    }
    else {
        $Profile = "lifebook-sso"
    }
}

if (-not $Region -or -not $Region.Trim()) {
    $Region = "us-east-1"
}

if (-not $JobId -or -not $JobId.Trim()) {
    $JobId = Read-Host "Enter jobId (e.g. job-xxxx...)"
}

$includeLogsParam = if ($IncludeLogs) { "true" } else { "false" }

Write-Host "get-job-status.ps1 - profile=$Profile region=$Region baseUrl=$BaseUrl jobId=$JobId includeLogs=$includeLogsParam" -ForegroundColor Cyan

$uri = "$($BaseUrl.TrimEnd('/'))/api/jobs?jobId=$JobId&includeLogs=$includeLogsParam"
Write-Host "GET $uri ..." -ForegroundColor Yellow

try {
    $resp = Invoke-RestMethod -Uri $uri -Method Get
}
catch {
    Write-Host "HTTP request failed: $($_.Exception.Message)" -ForegroundColor Red
    throw
}

if (-not $resp.ok) {
    Write-Host "`nAPI reported error:" -ForegroundColor Red
    $resp | ConvertTo-Json -Depth 8 | Write-Host
    exit 1
}

$job = $resp.job
if (-not $job) {
    Write-Host "`nNo job object in response. Raw:" -ForegroundColor Red
    $resp | ConvertTo-Json -Depth 8 | Write-Host
    exit 1
}

Write-Host "`nJob:" -ForegroundColor Green
"{0,-20} {1}" -f "jobId",           $job.jobId
"{0,-20} {1}" -f "workflowSlug",    $job.workflowSlug
"{0,-20} {1}" -f "status",          $job.status
"{0,-20} {1}" -f "clientRequestId", $job.clientRequestId

$inputJson = $null
try { $inputJson = $job.input | ConvertTo-Json -Depth 5 -Compress } catch { $inputJson = "<unserializable>" }
"{0,-20} {1}" -f "input", $inputJson

if ($IncludeLogs) {
    $logs = $resp.logs
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
