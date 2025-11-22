param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Allow CI to pass BaseUrl via APP_BASE_URL if the parameter is omitted/blank
if (-not $BaseUrl -or -not $BaseUrl.Trim()) {
    if ($env:APP_BASE_URL -and $env:APP_BASE_URL.Trim()) {
        $BaseUrl = $env:APP_BASE_URL
    }
}

if (-not $BaseUrl -or -not $BaseUrl.Trim()) {
    throw "BaseUrl was not provided and APP_BASE_URL env var is empty. Set APP_BASE_URL in CI or pass -BaseUrl."
}

Write-Host "== /api/jobs smoke test ==" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl" -ForegroundColor DarkCyan
Write-Host ""

# Helper for pretty JSON (best-effort)
function Show-JsonSnippet {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Json,
        [int]$MaxLength = 240
    )

    if ($Json.Length -gt $MaxLength) {
        $Json.Substring(0, $MaxLength) + "..."
    } else {
        $Json
    }
}

# 1) POST /api/jobs — allow both 2xx (wired) and 501 (stub mode) as success
$uriPost = "$BaseUrl/api/jobs"

$body = @{
    workflowKey    = "sample_hello_world"
    triggerType    = "manual"
    idempotencyKey = "smoke-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
} | ConvertTo-Json

Write-Host "POST $uriPost" -ForegroundColor Yellow

try {
    $respPost = Invoke-WebRequest -Uri $uriPost `
                                  -Method POST `
                                  -ContentType 'application/json' `
                                  -Body $body `
                                  -SkipHttpErrorCheck
} catch {
    Write-Host "POST /api/jobs threw an exception:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    throw
}

Write-Host "Status: $($respPost.StatusCode)" -ForegroundColor DarkYellow
$postBody = $respPost.Content
Write-Host ("Body  : " + (Show-JsonSnippet -Json $postBody)) -ForegroundColor DarkGray

if ($respPost.StatusCode -eq 501) {
    Write-Host "OK: /api/jobs POST is in stub mode (501 not wired to orchestrator yet)." -ForegroundColor Yellow
}
elseif ($respPost.StatusCode -ge 200 -and $respPost.StatusCode -lt 300) {
    Write-Host "OK: /api/jobs POST accepted a job (status $($respPost.StatusCode))." -ForegroundColor Green
}
else {
    Write-Host "FAIL: Unexpected status code from /api/jobs POST: $($respPost.StatusCode)" -ForegroundColor Red
    throw "Unexpected status code from /api/jobs POST: $($respPost.StatusCode)"
}

Write-Host ""

# 2) GET /api/jobs?workflowKey=sample_hello_world — expect 200 + jobs array
$uriGet = "$BaseUrl/api/jobs?workflowKey=sample_hello_world"
Write-Host "GET  $uriGet" -ForegroundColor Yellow

try {
    $respGet = Invoke-WebRequest -Uri $uriGet `
                                 -Method GET `
                                 -SkipHttpErrorCheck
} catch {
    Write-Host "GET /api/jobs threw an exception:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    throw
}

Write-Host "Status: $($respGet.StatusCode)" -ForegroundColor DarkYellow

$getJson = $respGet.Content
Write-Host ("Body  : " + (Show-JsonSnippet -Json $getJson)) -ForegroundColor DarkGray

if ($respGet.StatusCode -ne 200) {
    Write-Host "FAIL: Expected HTTP 200 from /api/jobs GET." -ForegroundColor Red
    throw "Unexpected status code from /api/jobs GET: $($respGet.StatusCode)"
}

try {
    $parsed = $getJson | ConvertFrom-Json
} catch {
    Write-Host "FAIL: Response from /api/jobs GET was not valid JSON." -ForegroundColor Red
    throw
}

$jobs = @()
if ($null -ne $parsed -and $parsed.PSObject.Properties.Name -contains 'jobs') {
    $jobs = $parsed.jobs
}

$jobsCount = ($jobs | Measure-Object).Count
Write-Host "Jobs returned: $jobsCount" -ForegroundColor DarkYellow

if ($jobsCount -ge 1) {
    $latest = $jobs[0]
    Write-Host ("Latest job: id={0}, status={1}, createdAt={2}" -f `
        $latest.jobId, $latest.status, $latest.createdAt) -ForegroundColor Green
} else {
    Write-Host "NOTE: No jobs returned. For now this is okay, but dev stub usually returns one." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Smoke test complete." -ForegroundColor Green
