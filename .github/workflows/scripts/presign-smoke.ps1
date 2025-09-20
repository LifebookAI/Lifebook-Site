# .github/workflows/scripts/presign-smoke.ps1
# Purpose: presign -> (optional) PUT upload -> (optional) GET verify
# Works on GitHub Actions runners (Linux/Windows) and trims secrets to avoid \n issues.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "▶ presign-smoke.ps1 starting..."

# ----------- Read env (trim to avoid stray whitespace/newlines) -----------
$apiBase   = (($env:PRESIGN_API_BASE)   ?? '').Trim()
$endpoint  = (($env:PRESIGN_ENDPOINT)   ?? '').Trim()     # optional; defaults below
$apiKey    = (($env:PRESIGN_API_KEY)    ?? '').Trim()     # optional; send if configured
$hmac      = (($env:PRESIGN_HMAC_SECRET)?? '').Trim()     # optional; send if configured
$cfBase    = (($env:CF_BASE_URL)        ?? '').Trim()     # optional; for GET verify

if (-not $endpoint) { $endpoint = 'presign' }

# Safe length prints (no null-conditional in strings)
$apiBaseLen = ($apiBase ?? '').Length
$apiKeyLen  = ($apiKey  ?? '').Length
$hmacLen    = ($hmac    ?? '').Length
Write-Host "API_BASE length: $apiBaseLen"
Write-Host "API_KEY  length: $apiKeyLen"
Write-Host "SECRET   length: $hmacLen"

# Validate required inputs
$missing = @()
if (-not $apiBase)  { $missing += 'PRESIGN_API_BASE' }
if (-not $endpoint) { $missing += 'PRESIGN_ENDPOINT' }
if ($missing.Count -gt 0) {
  throw "Missing one or more required env vars: $([string]::Join(', ', $missing))"
}

# ----------- Request payload -----------
# NOTE: These fields should match what your Lambda expects.
$keyPath   = "sources/hello.txt"
$bodyObj = @{
  checksum           = "crc32"                                    # algorithm label (not value)
  contentDisposition = 'attachment; filename="hello.txt"'
  contentType        = "text/plain"
  key                = $keyPath
  sse                = "AES256"
}
$bodyJson = $bodyObj | ConvertTo-Json -Compress -Depth 5

# ----------- Build headers -----------
$headers = @{
  "content-type" = "application/json"
}
if ($apiKey) { $headers["x-api-key"] = $apiKey }

# If your Lambda verifies an HMAC signature, we send ts + signature headers.
if ($hmac) {
  $ts = [System.DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  # ⚠️ Canonical string must match your Lambda. Common pattern:
  #   "<ts>\nPOST\n/<endpoint>\n<bodyJson>"
  $preimage = "$ts`nPOST`n/$endpoint`n$bodyJson"

  $h = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($hmac))
  try { $sigBytes = $h.ComputeHash([Text.Encoding]::UTF8.GetBytes($preimage)) } finally { $h.Dispose() }
  $sigHex = -join ($sigBytes | ForEach-Object { $_.ToString('x2') })

  $headers["x-lifebook-ts"]         = "$ts"
  $headers["x-lifebook-signature"]  = $sigHex
}

# ----------- POST presign -----------
$uri = ($apiBase.TrimEnd('/')) + '/' + ($endpoint.TrimStart('/'))
Write-Host "--- Presign request debug ---"
Write-Host "URI: $uri"
Write-Host "Body: $bodyJson"

function Show-HttpErrorAndThrow {
  param($ex, $label)
  $code = $null; $text = $null
  $resp = $ex.Exception.Response
  if ($resp -is [System.Net.Http.HttpResponseMessage]) {
    $code = [int]$resp.StatusCode
    try { $text = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult() } catch {}
  } elseif ($resp -and $resp.PSObject.Properties['StatusCode']) {
    $code = [int]$resp.StatusCode
    try {
      $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $text = $sr.ReadToEnd()
      $sr.Dispose()
    } catch {}
  }
  if ($code -ne $null) { Write-Host "$label failed: HTTP $code" }
  if ($text) { Write-Host $text }
  throw $ex
}

try {
  $presignResp = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $uri -Headers $headers -Body $bodyJson
} catch {
  Show-HttpErrorAndThrow $_ "Presign"
}

Write-Host "--- Presign response ---"
Write-Host "HTTP $($presignResp.StatusCode)"
Write-Host $presignResp.Content

# Parse JSON if possible
$presign = $null
try { $presign = $presignResp.Content | ConvertFrom-Json } catch {}

# Try to discover fields in a provider-agnostic way
$putUrl    = $null
$verifyUrl = $null

if ($presign) {
  if     ($presign.putUrl)     { $putUrl    = $presign.putUrl }
  elseif ($presign.url)        { $putUrl    = $presign.url }
  elseif ($presign.uploadURL)  { $putUrl    = $presign.uploadURL }
  elseif ($presign.uploadUrl)  { $putUrl    = $presign.uploadUrl }

  if     ($presign.verifyUrl)  { $verifyUrl = $presign.verifyUrl }
  elseif ($presign.getUrl)     { $verifyUrl = $presign.getUrl }
  elseif ($presign.cfUrl)      { $verifyUrl = $presign.cfUrl }
}

# If verify wasn't provided, build a CloudFront URL if base was supplied
if (-not $verifyUrl -and $cfBase) {
  $verifyUrl = ($cfBase.TrimEnd('/')) + '/' + $keyPath
}

# ----------- Optional PUT upload (only if we got a URL) -----------
if ($putUrl) {
  Write-Host "--- Uploading to presigned URL ---"
  # Collect any required headers from response; otherwise use sane defaults.
  $uploadHeaders = @{}
  if ($presign -and $presign.headers) {
    ($presign.headers | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name) | ForEach-Object {
      $uploadHeaders[$_] = $presign.headers.$_
    }
  } else {
    $uploadHeaders["content-type"]                 = $bodyObj.contentType
    $uploadHeaders["content-disposition"]          = $bodyObj.contentDisposition
    $uploadHeaders["x-amz-server-side-encryption"] = $bodyObj.sse
  }

  $bytes = [System.Text.Encoding]::UTF8.GetBytes("hello from Lifebook smoke $(Get-Date -Format o)`n")
  try {
    $putResp = Invoke-WebRequest -UseBasicParsing -Method PUT -Uri $putUrl -Headers $uploadHeaders -Body $bytes
    Write-Host "PUT status: $($putResp.StatusCode)"
  } catch {
    Show-HttpErrorAndThrow $_ "PUT upload"
  }

  # ----------- Optional GET verify -----------
  if ($verifyUrl) {
    Start-Sleep -Seconds 1
    try {
      $getResp = Invoke-WebRequest -UseBasicParsing -Method GET -Uri $verifyUrl
      Write-Host "GET verify status: $($getResp.StatusCode)"
    } catch {
      Show-HttpErrorAndThrow $_ "GET verify"
    }
  }
} else {
  Write-Host "No upload URL found in presign response; presign-only smoke succeeded."
}

Write-Host "✅ Smoke complete."
