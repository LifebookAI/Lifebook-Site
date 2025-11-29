param(
    [Parameter(Mandatory = $true)]
    [string]$JobId,

    [Parameter(Mandatory = $false)]
    [string]$OutFile
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $JobId -or -not $JobId.Trim()) {
    throw "JobId is required."
}

# Derive CDN base: NEXT_PUBLIC_FILES_BASE_URL or default CloudFront
$cdnBase = if ($env:NEXT_PUBLIC_FILES_BASE_URL -and $env:NEXT_PUBLIC_FILES_BASE_URL.Trim()) {
    $env:NEXT_PUBLIC_FILES_BASE_URL
}
else {
    "https://files.uselifebook.ai"
}
$cdnBase = $cdnBase.TrimEnd('/')

# Default output file if not provided
if (-not $OutFile -or -not $OutFile.Trim()) {
    $safeJobId = $JobId -replace '[^a-zA-Z0-9\-_]', '_'
    $OutFile = "job-$safeJobId-result.md"
}

$resultUrl = "$cdnBase/workflows/manual/$JobId/result.md"

Write-Host "Downloading result for jobId=$JobId" -ForegroundColor Cyan
Write-Host "  URL: $resultUrl" -ForegroundColor Yellow
Write-Host "  OutFile: $OutFile" -ForegroundColor Yellow

try {
    Invoke-WebRequest -Uri $resultUrl -OutFile $OutFile -ErrorAction Stop
}
catch {
    Write-Host "Download failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Download complete." -ForegroundColor Green

"`nPreview (first 20 lines):"
Get-Content -Path $OutFile -TotalCount 20 | ForEach-Object { "  $_" }
