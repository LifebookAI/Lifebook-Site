$ErrorActionPreference = 'Stop'

$API_BASE = $env:PRESIGN_API_BASE
$ENDPOINT = $env:PRESIGN_ENDPOINT
$API_KEY  = $env:PRESIGN_API_KEY
$SECRET   = $env:PRESIGN_HMAC_SECRET

if (-not $API_BASE -or -not $ENDPOINT -or -not $SECRET) {
  throw "Missing one or more required env vars: PRESIGN_API_BASE, PRESIGN_ENDPOINT, PRESIGN_HMAC_SECRET"
}

$bodyObj = @{
  key = "sources/hello.txt"
  contentType = "text/plain"
  contentDisposition = 'attachment; filename="hello.txt"'
  sse = "AES256"
  checksum = "crc32"
}
$body = ($bodyObj | ConvertTo-Json -Depth 5 -Compress)

function ToHexLower([byte[]]$bytes) { -join ($bytes | ForEach-Object { $_.ToString('x2') }) }
function HmacHexLower([string]$secret, [string]$message) {
  $key = [Text.Encoding]::UTF8.GetBytes($secret)
  $hmac = New-Object System.Security.Cryptography.HMACSHA256($key)
  $bytes = [Text.Encoding]::UTF8.GetBytes($message)
  ToHexLower ($hmac.ComputeHash($bytes))
}

$ts = [Math]::Floor((Get-Date -AsUTC -UFormat %s))
$stringToSign = "$ts`n$body"
$sig = HmacHexLower $SECRET $stringToSign

Write-Host "`n--- Presign request debug ---"
Write-Host "ts: $ts"
Write-Host "body: $body"
Write-Host "sig(hex): $sig"
Write-Host ""

$headers = @{
  "content-type" = "application/json"
  "x-ts" = "$ts"
  "x-sig" = $sig
}
if ($API_KEY) { $headers["x-api-key"] = $API_KEY }

$uri = "$API_BASE/$ENDPOINT"
try {
  $resp = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $uri -Headers $headers -Body $body
} catch {
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode.Value__) {
    $code = $_.Exception.Response.StatusCode.Value__
    throw "Presign HTTP $code"
  }
  throw
}

Write-Host "Presign OK"
Write-Host $resp.Content
