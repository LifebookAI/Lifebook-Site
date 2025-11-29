param(
    [Parameter(Mandatory = $false)]
    [string]$BaseUrl,

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

$cdnBase = if ($env:NEXT_PUBLIC_FILES_BASE_URL -and $env:NEXT_PUBLIC_FILES_BASE_URL.Trim()) {
    $env:NEXT_PUBLIC_FILES_BASE_URL
}
else {
    "https://files.uselifebook.ai"
}
$cdnBase = $cdnBase.TrimEnd('/')

$helperPath = Join-Path $PSScriptRoot 'run-job-and-wait.ps1'
if (-not (Test-Path $helperPath)) {
    throw "Missing helper script: $helperPath"
}

Write-Host "Smoke: running sample_hello_world via $helperPath ..." -ForegroundColor Cyan

# 1) Run helper with explicit named parameters, capture all output
if ($IncludeLogs) {
    $runOutput = & $helperPath -WorkflowSlug "sample_hello_world" -BaseUrl $BaseUrl -IncludeLogs 2>&1
}
else {
    $runOutput = & $helperPath -WorkflowSlug "sample_hello_world" -BaseUrl $BaseUrl 2>&1
}

# 2) Find jobId line from final summary
$jobLine = $runOutput | Select-String -Pattern '^jobId\s+(?<id>\S+)' | Select-Object -First 1
if (-not $jobLine) {
    Write-Host "Could not find jobId line in helper output:" -ForegroundColor Red
    $runOutput | ForEach-Object { "  $_" }
    exit 1
}

$jobId = $jobLine.Matches[0].Groups['id'].Value
Write-Host "Extracted jobId: $jobId" -ForegroundColor Green

# 3) Build CloudFront URL for result.md
$resultUrl = "$cdnBase/workflows/manual/$jobId/result.md"
Write-Host "Checking CloudFront result URL:" -ForegroundColor Yellow
Write-Host "  $resultUrl" -ForegroundColor Yellow

try {
    $resp = Invoke-WebRequest -Uri $resultUrl -Method Head -ErrorAction Stop
}
catch {
    Write-Host "HEAD request failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$code = [int]$resp.StatusCode
Write-Host "CloudFront status: $code" -ForegroundColor Cyan

if ($code -ge 200 -and $code -lt 300) {
    Write-Host "SUCCESS: result.md is reachable via CloudFront." -ForegroundColor Green
    exit 0
}
else {
    Write-Host "WARNING: unexpected CloudFront status code for result.md." -ForegroundColor Yellow
    exit 1
}
