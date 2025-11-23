param(
    # Base URL of the running Lifebook app (dev server or deployed URL)
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$paths = @(
    "/library",
    "/library/example-1",
    "/api/library",
    "/api/library/example-1"
)

Write-Host "Lifebook Library smoke — BaseUrl: $BaseUrl" -ForegroundColor Cyan

$allOk = $true

foreach ($path in $paths) {
    $url = ($BaseUrl.TrimEnd("/")) + $path
    try {
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing
        $code = $resp.StatusCode
        if ($code -ge 200 -and $code -lt 300) {
            Write-Host ("OK   {0} -> {1}" -f $url, $code) -ForegroundColor Green
        } else {
            Write-Host ("FAIL {0} -> {1}" -f $url, $code) -ForegroundColor Red
            $allOk = $false
        }
    } catch {
        try {
            $code = $_.Exception.Response.StatusCode.value__
        } catch {
            $code = "NO_RESPONSE"
        }
        Write-Host ("FAIL {0} -> {1}" -f $url, $code) -ForegroundColor Red
        $allOk = $false
    }
}

if (-not $allOk) {
    Write-Host "Library smoke FAILED." -ForegroundColor Red
    exit 1
}

Write-Host "Library smoke passed." -ForegroundColor Green
