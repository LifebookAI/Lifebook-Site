# .github/workflows/scripts/smoke.ps1
Set-StrictMode -Version latest
$ErrorActionPreference = 'Stop'

function Clean([string]$s) {
  if ($null -eq $s) { return '' }
  $s = $s.Trim()
  $s = $s -replace '"',''
  return [string]$s
}

$apiBase  = Clean $env:PRESIGN_API_BASE
$endpoint = Clean $env:PRESIGN_ENDPOINT
$apiKey   = Clean $env:PRESIGN_API_KEY
$secret   = Clean $env:PRESIGN_HMAC_SECRET

$need = @()
if ([string]::IsNullOrWhiteSpace($apiKey))   { $need += 'PRESIGN_API_KEY' }
if ([string]::IsNullOrWhiteSpace($endpoint) -and [string]::IsNullOrWhiteSpace($apiBase)) {
  $need += 'PRESIGN_API_BASE or PRESIGN_ENDPOINT'
}
if ($need.Count -gt 0) { throw "Missing one or more required env vars: $([string]::Join(', ', $need))" }

$uri = if ($endpoint) { $endpoint } else { ($apiBase.TrimEnd('/') + '/presign') }

$bodyObj = [ordered]@{
  key               = 'sources/hello.txt'
  contentType       = 'text/plain'
  contentDisposition= 'attachment; filename="hello.txt"'
  sse               = 'AES256'
  checksum          = 'crc32'
}
$bodyJson = $bodyObj | ConvertTo-Json -Depth 4 -Compress

$headers = @{ 'x-api-key' = $apiKey }

# Optional HMAC header (timestamp + '\n' + body) if you set PRESIGN_HMAC_SECRET
if ($secret) {
  $ts        = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
  $toSign    = "$ts`n$bodyJson"
  $keyBytes  = [System.Text.Encoding]::UTF8.GetBytes($secret)
  $dataBytes = [System.Text.Encoding]::UTF8.GetBytes($toSign)

  # 👇 IMPORTANT: use ::new(byte[]) so PowerShell doesn't treat the byte[] as 64 separate args
  $hmac   = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)
  $sigHex = ($hmac.ComputeHash($dataBytes) | ForEach-Object { $_.ToString('x2') }) -join ''

  $headers['x-signature'] = $sigHex
  $headers['x-timestamp'] = $ts
}

try {
  $resp = Invoke-RestMethod -Method POST -Uri $uri -Headers $headers -Body $bodyJson -ContentType 'application/json; charset=utf-8'
  if ($resp.url) {
    Write-Host "::notice::Presign OK"
    Write-Host "::notice::URL: $($resp.url)"
  } else {
    Write-Host "::notice::Presign OK (no URL)"
  }
}
catch {
  $code = $_.Exception.Response.StatusCode.value__
  $msg  = $_.ErrorDetails.Message
  if ($msg) { Write-Host "::error::Presign failed HTTP $code - $msg" } else { Write-Host "::error::Presign failed HTTP $code" }
  throw
}
