# .github/workflows/scripts/presign-smoke.ps1
#!pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Clean([string]$s) {
  if ($null -eq $s) { return '' }
  $t = $s.Trim()
  # strip any surrounding quotes and ALL control chars (CR/LF, NUL, etc.)
  $t = ($t -replace '^[\"'']|[\"'']$','')
  $bytes = [Text.Encoding]::UTF8.GetBytes($t)
  $bytes = $bytes | Where-Object { $_ -notin 0,10,13 }  # remove NUL, LF, CR
  return [Text.Encoding]::UTF8.GetString([byte[]]$bytes)
}

$apiBase  = Clean $env:PRESIGN_API_BASE
$endpoint = Clean $env:PRESIGN_ENDPOINT     # optional; overrides apiBase/presign
$apiKey   = Clean $env:PRESIGN_API_KEY
$secret   = Clean $env:PRESIGN_HMAC_SECRET  # optional

$missing = @()
if ([string]::IsNullOrWhiteSpace($apiBase) -and [string]::IsNullOrWhiteSpace($endpoint)) { $missing += 'PRESIGN_API_BASE or PRESIGN_ENDPOINT' }
if ([string]::IsNullOrWhiteSpace($apiKey)) { $missing += 'PRESIGN_API_KEY' }
if ($missing.Count -gt 0) { throw "Missing one or more required env vars: $([string]::Join(', ', $missing))" }

Write-Host "=== smoke.ps1 starting..."
Write-Host ("API_BASE length: {0}" -f ($apiBase?.Length))
Write-Host ("API_KEY  length: {0}" -f ($apiKey?.Length))
Write-Host ("SECRET   length: {0}" -f ($secret?.Length))

$uri = if ($endpoint) { $endpoint } else { ($apiBase.TrimEnd('/')) + "/presign" }

$bodyObj = [ordered]@{
  key                = "sources/hello.txt"
  contentType        = "text/plain"
  contentDisposition = "attachment; filename=`"hello.txt`""
  sse                = "AES256"
  checksum           = "crc32"
}
$bodyJson = ($bodyObj | ConvertTo-Json -Depth 4 -Compress)

Write-Host "`n--- Presign request debug ---"
Write-Host "URI: $uri"
Write-Host "Body: $bodyJson"

# Build headers AFTER sanitizing to avoid newline issues
$headers = @{ 'x-api-key' = $apiKey }

if ($secret) {
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $toSign = "$ts.$bodyJson"
  $hmac  = New-Object System.Security.Cryptography.HMACSHA256([Text.Encoding]::UTF8.GetBytes($secret))
  $sig   = ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign)) | ForEach-Object { $_.ToString('x2') }) -join ''
  $headers['x-signature'] = $sig
  $headers['x-timestamp'] = "$ts"
}

try {
  # IMPORTANT: use Invoke-RestMethod (not Invoke-WebRequest) and pass ContentType separately
  $resp = Invoke-RestMethod -Method POST -Uri $uri -Headers $headers -Body $bodyJson -ContentType 'application/json; charset=utf-8'
  Write-Host "`nPresign OK"
  if ($resp.url) { Write-Host "URL: $($resp.url)" }
} catch {
  $status = $null; try { $status = $_.Exception.Response.StatusCode.value__ } catch {}
  Write-Host "Presign failed: HTTP $status"
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  throw
}
