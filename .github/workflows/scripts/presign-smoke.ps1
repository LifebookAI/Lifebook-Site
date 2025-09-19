# Requires: PRESIGN_API_BASE or PRESIGN_ENDPOINT, HMAC_SECRET, optional API_KEY, CF_BASE_URL
$ErrorActionPreference = "Stop"

function Assert-Env([string]$name) {
  if (-not $env:$name -or $env:$name.Trim().Length -eq 0) {
    throw "Missing env var: $name"
  }
}

# Choose endpoint
$endpoint = $env:PRESIGN_ENDPOINT
if (-not $endpoint) {
  Assert-Env "PRESIGN_API_BASE"
  $endpoint = ($env:PRESIGN_API_BASE.TrimEnd('/')) + "/presign"
}

Assert-Env "HMAC_SECRET"

# Prepare a tiny test file
$tmp = Join-Path $env:TEMP "hello.txt"
"hello from smoke $(Get-Date -AsUTC)" | Set-Content -Encoding UTF8 $tmp

# Build request body
$key = "sources/hello.txt"
$bodyObj = @{
  key                = $key
  contentType        = "text/plain"
  contentDisposition = "attachment; filename=`"hello.txt`""
  sse                = "AES256"
}
$bodyJson = $bodyObj | ConvertTo-Json -Compress
$ts = [int][double]::Parse((Get-Date -UFormat %s))  # Unix seconds

# HMAC(sig) = hex(HMAC-SHA256(secret, ts + "." + bodyJson))
$secretBytes = [Convert]::FromHexString($env:HMAC_SECRET.Trim())
$hmac = New-Object System.Security.Cryptography.HMACSHA256 ($secretBytes)
$bytes = [Text.Encoding]::UTF8.GetBytes("$ts.$bodyJson")
$sigBytes = $hmac.ComputeHash($bytes)
$sigHex = ($sigBytes | ForEach-Object { $_.ToString("x2") }) -join ""

# Headers
$headers = @{
  "x-presign-ts"   = "$ts"
  "x-presign-sig"  = $sigHex
  "content-type"   = "application/json"
}
if ($env:API_KEY) { $headers["x-api-key"] = $env:API_KEY }

Write-Host "`n--- Presign request debug ---"
Write-Host "ts: $ts"
Write-Host "body: $bodyJson"
Write-Host "sig(hex): $sigHex"

# Request presign
try {
  $resp = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $endpoint -Headers $headers -Body $bodyJson
} catch {
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 502) {
    Start-Sleep -Seconds 2
    $resp = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $endpoint -Headers $headers -Body $bodyJson
  } else { throw }
}

if ($resp.StatusCode -lt 200 -or $resp.StatusCode -gt 299) {
  throw "Presign HTTP $($resp.StatusCode)"
}

$presign = ($resp.Content | ConvertFrom-Json)
$putUrl  = $presign.url
if (-not $putUrl) { throw "No presign URL returned." }

# Upload the file using the presigned URL
$bytesToSend = [System.IO.File]::ReadAllBytes($tmp)
$putHeaders = @{ "content-type" = "text/plain" }
# If your Lambda includes checksum headers in the URL, S3 will validate automatically.

$putResp = Invoke-WebRequest -UseBasicParsing -Method PUT -Uri $putUrl -Headers $putHeaders -Body $bytesToSend
if ($putResp.StatusCode -lt 200 -or $putResp.StatusCode -gt 299) {
  throw "PUT HTTP $($putResp.StatusCode)"
}

# Compose public URL via CloudFront (optional)
$out = "Uploaded as: " + $(if ($env:CF_BASE_URL) { ($env:CF_BASE_URL.TrimEnd('/')) + "/" + $key } else { "CF_BASE_URL not set" })
$outPath = ".github/workflows/scripts/smoke-output.txt"
$out | Set-Content $outPath
Write-Host "`n" $out
