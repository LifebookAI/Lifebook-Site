<#  Lifebook.AI — presign + upload smoke test
    Runs in GitHub Actions PowerShell (Windows/Linux/macOS runners)

    Requires the following repo secrets:
      - PRESIGN_API_BASE      e.g. https://l6571skkfi.execute-api.us-east-1.amazonaws.com/prod
      - PRESIGN_ENDPOINT      e.g. presign
      - PRESIGN_API_KEY       (optional; only if your API expects a key header)
      - PRESIGN_HMAC_SECRET   64-char hex or secret used to sign the request body
      - CF_BASE_URL           (optional; CloudFront domain to build the GET url)
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "▶ presign-smoke.ps1 starting..."

# ----------- Read + validate env -----------
$apiBase  = $env:PRESIGN_API_BASE
$endpoint = $env:PRESIGN_ENDPOINT
$apiKey   = $env:PRESIGN_API_KEY
$secret   = $env:PRESIGN_HMAC_SECRET
$cfBase   = $env:CF_BASE_URL

Write-Host "API_BASE length: $($apiBase?.Length)"
Write-Host "API_KEY  length: $($apiKey?.Length)"
Write-Host "SECRET   length: $($secret?.Length)"

$missing = @()
if (-not $apiBase)  { $missing += 'PRESIGN_API_BASE' }
if (-not $endpoint) { $missing += 'PRESIGN_ENDPOINT' }
if (-not $secret)   { $missing += 'PRESIGN_HMAC_SECRET' }
if ($missing.Count -gt 0) {
  throw "Missing one or more required env vars: $([string]::Join(', ', $missing))"
}

# Normalize URL parts
$apiBase  = $apiBase.TrimEnd('/')
$endpoint = $endpoint.TrimStart('/')

# ----------- Portable CRC32 (fallback) -----------
# Uses lookup-table; works on all runners without extra assemblies.
$__crc32Table = 0..255 | ForEach-Object {
  $c = $_
  0..7 | ForEach-Object {
    if ($c -band 1) { $c = (0xEDB88320 -bxor ($c -shr 1)) } else { $c = ($c -shr 1) }
  }; $c
}
function Get-Crc32Hex([byte[]] $bytes) {
  $crc = 0xFFFFFFFF
  foreach ($b in $bytes) {
    $idx = ($crc -bxor $b) -band 0xFF
    $crc = ($crc -shr 8) -bxor $__crc32Table[$idx]
  }
  return '{0:x8}' -f (-bnot $crc -band 0xFFFFFFFF)
}

# ----------- Build tiny test object -----------
$objectKey  = 'sources/hello.txt'
$filename   = 'hello.txt'
$mime       = 'text/plain'
$sse        = 'AES256'
$bodyText   = "hello from smoke $(Get-Random)"
$bytes      = [System.Text.Encoding]::UTF8.GetBytes($bodyText)

# Compute CRC32; prefer System.IO.Hashing when available
try {
  $crcBytes = [System.IO.Hashing.Crc32]::Hash($bytes)
  $crcHex   = ($crcBytes | ForEach-Object { $_.ToString('x2') }) -join ''
} catch {
  $crcHex   = Get-Crc32Hex $bytes
}
# (Presign API expects a field telling which checksum we send)
$checksumAlgo = 'crc32'

# ----------- Prepare presign request -----------
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

# Body that your Lambda expects (based on your previous logs)
$reqObj = [ordered]@{
  checksum            = $checksumAlgo
  contentDisposition  = "attachment; filename=""$filename"""
  contentType         = $mime
  key                 = $objectKey
  sse                 = $sse
}
$reqJson = ($reqObj | ConvertTo-Json -Compress)

# Signature: HMAC-SHA256 over "<ts>\n<json>"
$toSign   = "$ts`n$reqJson"
$hmac     = New-Object System.Security.Cryptography.HMACSHA256 ([Text.Encoding]::UTF8.GetBytes($secret))
$sigBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign))
$sigHex   = ($sigBytes | ForEach-Object { $_.ToString('x2') }) -join ''

Write-Host ""
Write-Host "--- Presign request debug ---"
Write-Host "ts: $ts"
Write-Host "body: $reqJson"
Write-Host "sig(hex): $sigHex"
Write-Host ""

# Headers (avoid any newline characters!)
$headers = @{
  'Content-Type' = 'application/json'
  'x-ts'         = "$ts"
  'x-signature'  = $sigHex
}
if ($apiKey) { $headers['x-api-key'] = $apiKey.Trim() }  # key is optional

$presignUrl = "$apiBase/$endpoint"

# ----------- Call presign API -----------
try {
  $pres = Invoke-RestMethod -Method POST -Uri $presignUrl -Headers $headers -Body $reqJson -TimeoutSec 30 -ErrorAction Stop
} catch {
  # Surface status code if available
  $status = $_.Exception.Response?.StatusCode.value__
  if ($status) {
    Write-Host "Presign failed: HTTP $status"
    throw "Presign HTTP $status"
  }
  throw
}

# Extract upload URL (accept a few common shapes)
$putUrl = $null
if ($pres -is [string]) {
  $putUrl = $pres
} elseif ($pres.url) {
  $putUrl = [string]$pres.url
} elseif ($pres.uploadUrl) {
  $putUrl = [string]$pres.uploadUrl
} elseif ($pres.putUrl) {
  $putUrl = [string]$pres.putUrl
}
if (-not $putUrl) { throw "Presign response missing URL: $($pres | ConvertTo-Json -Compress)" }

Write-Host "Got presigned URL (truncated): $($putUrl.Substring(0, [Math]::Min(120, $putUrl.Length)))..."

# ----------- Upload with PUT to S3 -----------
# NOTE: You *must* send the same headers that the presign was created for
$putHeaders = @{
  'Content-Disposition' = "attachment; filename=""$filename"""
  'x-amz-server-side-encryption' = $sse
}

try {
  $putResp = Invoke-WebRequest -Uri $putUrl -Method Put -UseBasicParsing -Headers $putHeaders -ContentType $mime -Body $bytes -TimeoutSec 60 -ErrorAction Stop
} catch {
  $status = $_.Exception.Response?.StatusCode.value__
  if ($status) {
    Write-Host "PUT failed: HTTP $status"
    throw "PUT HTTP $status"
  }
  throw
}

Write-Host "PUT upload OK."

# Optional: show public/edge URL candidate (no hard GET to avoid eventual consistency flakes)
if ($cfBase) {
  $edgeUrl = ($cfBase.TrimEnd('/')) + '/' + $objectKey
  Write-Host "Candidate GET via CloudFront: $edgeUrl"
}

Write-Host "✅ Smoke test finished successfully."
