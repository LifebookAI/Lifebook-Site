# .github/workflows/scripts/smoke.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Clean([string]$s) {
  if ([string]::IsNullOrWhiteSpace($s)) { return '' }
  ($s.Trim()) -replace '^\s*["'']|["'']\s*$', ''
}

$apiBase  = Clean $env:PRESIGN_API_BASE
$endpoint = Clean $env:PRESIGN_ENDPOINT
$apiKey   = Clean $env:PRESIGN_API_KEY
$secret   = Clean $env:PRESIGN_HMAC_SECRET

$need = @()
if ([string]::IsNullOrWhiteSpace($apiBase) -and [string]::IsNullOrWhiteSpace($endpoint)) { $need += 'PRESIGN_API_BASE or PRESIGN_ENDPOINT' }
if ([string]::IsNullOrWhiteSpace($apiKey)) { $need += 'PRESIGN_API_KEY' }
if ($need.Count -gt 0) { throw "Missing one or more required env vars: $([string]::Join(', ', $need))" }

$uri = if ($endpoint) { $endpoint } else { ($apiBase.TrimEnd('/')) + '/presign' }

$bodyObj = [ordered]@{
  key                = 'sources/hello.txt'
  contentType        = 'text/plain'
  contentDisposition = 'attachment; filename="hello.txt"'
  sse                = 'AES256'
  checksum           = 'crc32'
}
$bodyJson = ($bodyObj | ConvertTo-Json -Depth 4 -Compress)

$headers = @{ 'x-api-key' = $apiKey }

if ($secret) {
  $ts    = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
  $toSig = $bodyJson + '|' + $ts
  $hmac  = New-Object System.Security.Cryptography.HMACSHA256([Text.Encoding]::UTF8.GetBytes($secret))
  $sig   = ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSig)) | ForEach-Object { $_.ToString('x2') }) -join ''
  $headers['x-signature'] = $sig
  $headers['x-timestamp'] = $ts
}

try {
  $resp = Invoke-RestMethod -Method POST -Uri $uri -Headers $headers -Body $bodyJson -ContentType 'application/json; charset=utf-8'
  Write-Host "::notice::Presign OK"
  if ($resp.url) { Write-Host "::notice::URL: $($resp.url)" }
} catch {
  $code = $null; try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
  Write-Host "::error::Presign failed HTTP $code"
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  throw
}
