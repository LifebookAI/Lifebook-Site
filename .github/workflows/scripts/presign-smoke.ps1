param()

# --- Read env vars expected from workflow env mapping ---
$API_BASE = $env:PRESIGN_API_BASE
$ENDPOINT = $env:PRESIGN_ENDPOINT
$SECRET   = $env:PRESIGN_HMAC_SECRET
$API_KEY  = $env:PRESIGN_API_KEY
$CF_BASE  = $env:CF_BASE_URL

$missing = @()
if (-not $API_BASE) { $missing += 'PRESIGN_API_BASE' }
if (-not $ENDPOINT) { $missing += 'PRESIGN_ENDPOINT' }
if (-not $SECRET)   { $missing += 'PRESIGN_HMAC_SECRET' }
if ($missing.Count -gt 0) {
  throw "Missing one or more required env vars: $([string]::Join(', ', $missing))"
}

Write-Host ""
Write-Host "API_BASE length: $($API_BASE.Length)"
Write-Host "API_KEY  length: $($API_KEY.Length)"
Write-Host "SECRET  length: $($SECRET.Length)"
Write-Host ""

# --- Prepare tiny test object we will upload ---
$filename = "hello.txt"
$bodyText = "hello from GitHub Actions at $(Get-Date -AsUTC -Format o)"
$bytes    = [System.Text.Encoding]::UTF8.GetBytes($bodyText)

# CRC32 (requires .NET 6+ which GitHub runners have)
$crcBytes = [System.IO.Hashing.Crc32]::Hash($bytes)
$crcHex   = ([System.BitConverter]::ToString($crcBytes)).Replace('-', '').ToLowerInvariant()

# Key in S3
$key = "sources/$filename"
$ts  = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
# HMAC over "ts.key.crc32hex"
$toSign = "$ts.$key.$crcHex"
$hmac   = New-Object System.Security.Cryptography.HMACSHA256 ([System.Text.Encoding]::UTF8.GetBytes($SECRET))
$sigHex = ([System.BitConverter]::ToString($hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($toSign)))).Replace('-', '').ToLowerInvariant()

# --- Call presign API ---
$uri = ($API_BASE.TrimEnd('/') + '/' + $ENDPOINT.TrimStart('/'))
$payload = [ordered]@{
  key                = $key
  contentDisposition = "attachment; filename=`"$filename`""
  contentType        = "text/plain"
  sse                = "AES256"
  checksum           = "crc32"
}
$payloadJson = $payload | ConvertTo-Json -Depth 4

Write-Host "`n--- Presign request debug ---"
Write-Host "ts: $ts"
Write-Host "body: $payloadJson"
Write-Host "sig(hex): $sigHex"
Write-Host ""

$headers = @{
  "x-lb-ts"  = "$ts"
  "x-lb-sig" = "$sigHex"
}
if ($API_KEY) { $headers["x-api-key"] = $API_KEY }

$handler = New-Object System.Net.Http.HttpClientHandler
$client  = New-Object System.Net.Http.HttpClient($handler)
$req     = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, $uri)
$req.Content = New-Object System.Net.Http.StringContent($payloadJson, [System.Text.Encoding]::UTF8, "application/json")
foreach ($k in $headers.Keys) { $null = $req.Headers.TryAddWithoutValidation($k, $headers[$k]) }

$res = $client.Send($req)
if (-not $res.IsSuccessStatusCode) {
  $body = $res.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  Write-Host "Presign failed:"
  Write-Host $body
  $code = [int]$res.StatusCode
  throw "Presign HTTP $code"
}
$respJson = $res.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json

# Expected presign response shape:
# {
#   "url": "https://s3.../bucket/key?...",
#   "headers": { "x-amz-server-side-encryption": "...", "x-amz-checksum-crc32": "..." },
#   "publicUrl": "https://files.uselifebook.ai/sources/hello.txt"
# }

$putUrl  = $respJson.url
$putHdrs = $respJson.headers
$public  = $respJson.publicUrl

# --- PUT to S3 using the presigned URL ---
$putReq = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Put, $putUrl)
$putReq.Content = New-Object System.Net.Http.ByteArrayContent($bytes)
# Add any required headers from presign (case-insensitive)
if ($putHdrs) {
  $dict = $putHdrs | ConvertTo-Json -Depth 5 | ConvertFrom-Json
  foreach ($p in $dict.PSObject.Properties) {
    $name = [string]$p.Name
    $val  = [string]$p.Value
    if ($name -ieq 'content-type') {
      $null = $putReq.Content.Headers.TryAddWithoutValidation('content-type', $val)
    } else {
      $null = $putReq.Headers.TryAddWithoutValidation($name, $val)
    }
  }
}
$putRes = $client.Send($putReq)
if (-not $putRes.IsSuccessStatusCode) {
  $code = [int]$putRes.StatusCode
  $err  = $putRes.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  Write-Host "Upload failed [$code]"
  Write-Host $err
  throw "Upload HTTP $code"
}

# --- Save/print public URL if returned ---
if ($public) {
  Set-Content -Path ./public-url.txt -Value $public -Encoding UTF8
  Write-Host "`nPublic URL:"
  Write-Host $public
} else {
  Write-Host "No public URL in response."
}
