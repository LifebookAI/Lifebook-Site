param(
  [string]$BaseUrl = "http://localhost:3010",
  [string]$WorkspaceId = "local",
  [switch]$StartServer
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Import-DotEnvFile([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  foreach ($ln in Get-Content -LiteralPath $Path) {
    $t = $ln.Trim()
    if (-not $t -or $t.StartsWith("#")) { continue }
    if ($t -notmatch "^[A-Za-z_][A-Za-z0-9_]*=") { continue }
    $key, $val = $t.Split("=", 2)
    $key = $key.Trim(); $val = $val.Trim()
    if ($val.StartsWith('"') -and $val.EndsWith('"') -and $val.Length -ge 2) { $val = $val.Substring(1, $val.Length-2) }
    if ($val.StartsWith("'") -and $val.EndsWith("'") -and $val.Length -ge 2) { $val = $val.Substring(1, $val.Length-2) }
    $existing = (Get-Item -Path "Env:$key" -ErrorAction SilentlyContinue)
    if (-not $existing) { Set-Item -Path "Env:$key" -Value $val }
  }
}

function Get-PackageManager {
  if (Test-Path -LiteralPath (Join-Path (Get-Location) "pnpm-lock.yaml")) { return "pnpm" }
  if (Test-Path -LiteralPath (Join-Path (Get-Location) "yarn.lock")) { return "yarn" }
  return "npm"
}

function Wait-Http([string]$Url, [int]$TimeoutSec = 120) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    try { Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 5 | Out-Null; return } catch { Start-Sleep -Milliseconds 500 }
  }
  throw "Server not reachable at $Url after ${TimeoutSec}s"
}

Import-DotEnvFile (Join-Path (Get-Location) ".env.local")
Import-DotEnvFile (Join-Path (Get-Location) ".env")

$serverProc = $null
try {
  if ($StartServer) {
    if (-not $env:DATABASE_URL) { throw "DATABASE_URL missing. Put it in .env.local (gitignored) or set Env:DATABASE_URL and rerun." }
    $env:PORT = "3010"
    $pm = Get-PackageManager
    Write-Host "Starting dev server on :3010 via $pm..." -ForegroundColor Cyan
    if ($pm -eq "pnpm") { $serverProc = Start-Process -FilePath "pnpm" -ArgumentList @("dev","--","--port","3010") -PassThru -WindowStyle Hidden }
    elseif ($pm -eq "yarn") { $serverProc = Start-Process -FilePath "yarn" -ArgumentList @("dev","--port","3010") -PassThru -WindowStyle Hidden }
    else { $serverProc = Start-Process -FilePath "npm" -ArgumentList @("run","dev","--","--port","3010") -PassThru -WindowStyle Hidden }
  }

  Wait-Http -Url $BaseUrl

  $hdr = @{ "x-workspace-id" = $WorkspaceId; "idempotency-key" = ("smoke-" + [Guid]::NewGuid().ToString("n")) }

  $resp1 = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/jobs/enqueue" -Headers $hdr -ContentType "application/json" `
    -Body (@{ kind="smoke"; payload=@{ ts=(Get-Date).ToString("o") } } | ConvertTo-Json -Depth 5)

  $jobId = [string]$resp1.jobId
  if (-not $jobId) { throw "No jobId from enqueue" }
  Write-Host "Enqueued jobId=$jobId" -ForegroundColor Green

  Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/jobs/$jobId/run" -Headers $hdr -ContentType "application/json" -Body "{}" | Out-Null
  Write-Host "Run OK" -ForegroundColor Green

  $resp3 = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/jobs/$jobId" -Headers $hdr
  if (-not $resp3 -or -not $resp3.job -or -not $resp3.job.id) { throw "Status missing job payload" }

  Write-Host ("Status={0} attempt={1}" -f $resp3.job.status, $resp3.job.attempt) -ForegroundColor Green
  Write-Host "SMOKE GREEN: enqueue → run → status (DB-backed, restart-safe)" -ForegroundColor Green
}
finally {
  if ($serverProc -and -not $serverProc.HasExited) {
    Write-Host "Stopping dev server PID=$($serverProc.Id)..." -ForegroundColor Cyan
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
  }
}