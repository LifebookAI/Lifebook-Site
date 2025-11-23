param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$paths = @(
  "/tracks",
  "/tracks/aws-foundations",
  "/tracks/devops-essentials"
)

foreach ($path in $paths) {
  $url = $BaseUrl.TrimEnd("/") + $path
  Write-Host "Checking $url ..." -ForegroundColor Cyan
  $resp = Invoke-WebRequest -Uri $url -UseBasicParsing
  if ($resp.StatusCode -ne 200) {
    throw "Expected HTTP 200 from $url but got $($resp.StatusCode)"
  }
}

Write-Host "Study tracks smoke OK." -ForegroundColor Green
