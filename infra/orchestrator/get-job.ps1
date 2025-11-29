param(
    [Parameter(Mandatory = $true)]
    [string]$JobId,

    [Parameter(Mandatory = $false)]
    [string]$BaseUrl
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $JobId -or -not $JobId.Trim()) {
    throw "JobId is required."
}

# Derive BaseUrl (same pattern as smoke-hello-world.ps1)
if (-not $BaseUrl -or -not $BaseUrl.Trim()) {
    if ($env:LFLBK_API_BASE_URL -and $env:LFLBK_API_BASE_URL.Trim()) {
        $BaseUrl = $env:LFLBK_API_BASE_URL
    }
    else {
        $BaseUrl = "http://localhost:3000"
    }
}

$BaseUrl = $BaseUrl.TrimEnd('/')

# Build URL for /api/jobs
$encodedJobId = [System.Uri]::EscapeDataString($JobId)
$uri = "$BaseUrl/api/jobs?jobId=$encodedJobId&includeLogs=true"

Write-Host "Fetching job from $uri" -ForegroundColor Cyan

try {
    $resp = Invoke-RestMethod -Uri $uri -Method Get -ErrorAction Stop
}
catch {
    Write-Host "Request failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`nRaw job payload (pretty JSON):" -ForegroundColor Green
$resp | ConvertTo-Json -Depth 10
