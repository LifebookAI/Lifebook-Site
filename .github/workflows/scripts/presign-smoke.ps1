# .github/workflows/scripts/presign-smoke.ps1
#!pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Clean([string]$s) {
  if ($null -eq $s) { return '' }
  # trim, strip wrapping quotes, remove any CR/LF anywhere
  return ($s.Trim() -replace '^[\"'']|[\"'']$','' -replace '[\r\n]+','')
}

# ---- env (from GitHub secrets) ----
$apiBase  = Clean $env:PRESIGN_API_BASE
$endpoint = Clean $env:PRESIGN_ENDPOINT    # optional override; if blank use $apiBase/presign
$apiKey   = Clean $env:PRESIGN_API_KEY
$secret   = Clean $env:PRESIGN_HMAC_SECRET # optional; only used if provided

# ---- sanity ----
$missing = @()
if ([string]::IsNullOrWhiteSpace($apiBase) -and [string]::IsNullOrWhiteSpace($endpoint)) { $missing += 'PRESIGN_API_BASE or PRESIGN_ENDPOINT' }
if ([string]::IsNullOrWhiteSpace($apiKey))   { $missing += 'PRESIGN_API_KEY' }
if ($missing.Count -gt 0) { throw "Missing one or more required env vars: $([string]::Join(', ', $missing))" }

Write-Host "=== smoke.ps1 starting..."
Write-Host ("API_BASE length: {0}" -f ($apiBase?.Length))
Write-Host ("API_KEY  length: {0}" -f ($apiKey?.Length))
Write-Host ("SECRET   length: {0}" -f ($secret?.Length))

if ($apiKey.Length -eq 65)  { Write-Host "NOTE: API key looked like it had a trailing newline; sanitized." }
if ($secret  -and $secret.Length -eq 65) { Write-Host "NOTE: HMAC secret looked like it had a trailing newline; sanitized." }

# ---- target URL ----
$uri = if (![string]::IsNullOrWhiteSpace($endpoint)) { $endpoint } else { ($apiBase.TrimEnd('/')) + "/presign" }

# ---- request body (JSON) ----
$bodyObj = [ordered]@{
  key                = "sources/hello.txt"
  contentType        = "text/plain"
  contentDisposition = "attachment; filename=`"hello.txt`""
  sse                = "AES256"
  checksum           = "crc32"
}
$bodyJson = ($bodyObj | ConvertTo-Json -Depth 4 -Compress)

# ---- headers ----
$headers = @{ "x-api-key" = $apiKey }

# optional HMAC (if secret provided)
if ($secret) {
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $toSign = "$ts.$bodyJson"
  $hmac  = New-Object System.Security.Cryptography.HMACSHA256([Text.Encoding]::UTF8.GetBytes($secret))
  $sig   = ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign)) | ForEach-Object { $_.ToString('x2') }) -join ''
  $headers["x-signature"] = $sig
  $headers["x-timestamp"] = "$ts"
}

Write-Host "`n--- Presign request debug ---"
Write-Host "URI: $uri"
Write-Host "Body: $bodyJson"

try {
  $resp = Invoke-RestMethod `
    -Method POST `
    -Uri $uri `
    -Headers $headers `
    -Body $bodyJson `
    -ContentType 'application/json; charset=utf-8'

  Write-Host "`nPresign OK"
  if ($resp.url) { Write-Host "URL: $($resp.url)" }
} catch {
  $status = $null
  try { $status = $_.Exception.Response.StatusCode.value__ } catch {}
  Write-Host "Presign failed: HTTP $status"
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  throw
}
