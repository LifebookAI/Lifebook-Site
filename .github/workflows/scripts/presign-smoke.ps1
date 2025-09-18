# presign-smoke.ps1 — CI smoke test
# 1) presign via API (HMAC ts.body)  2) PUT to S3 with required headers  3) Verify via CloudFront

$ErrorActionPreference = "Stop"

# ===== Inputs from the workflow env =====
$API_BASE = "$env:API_BASE".Trim()      # e.g. https://api.uselifebook.ai/presign  (or the execute-api .../prod/presign)
$API_KEY  = "$env:API_KEY".Trim()
$SECRET   = "$env:SECRET".Trim()

Write-Host "API_BASE length: $($API_BASE.Length)"
Write-Host "API_KEY  length: $($API_KEY.Length)"
Write-Host "SECRET   length: $($SECRET.Length)"

if ([string]::IsNullOrWhiteSpace($API_BASE) -or
    [string]::IsNullOrWhiteSpace($API_KEY)  -or
    [string]::IsNullOrWhiteSpace($SECRET)) {
  Write-Error "Missing one or more required env vars: API_BASE, API_KEY, SECRET"
}

# ===== Helpers =====
function HexToBytes([string]$hex) {
  if ($hex -match '^[0-9a-fA-F]+$' -and ($hex.Length % 2 -eq 0)) {
    $out = New-Object byte[] ($hex.Length/2)
    for ($i = 0; $i -lt $hex.Length; $i += 2) { $out[$i/2] = [Convert]::ToByte($hex.Substring($i,2),16) }
    return $out
  }
  return [Text.Encoding]::UTF8.GetBytes($hex)
}
function HmacHex([byte[]]$key, [string]$msg) {
  $h = [System.Security.Cryptography.HMACSHA256]::new($key)
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
    $hash  = $h.ComputeHash($bytes)
    return -join ($hash | ForEach-Object { $_.ToString('x2') })
  } finally { $h.Dispose() }
}
function NowTs() { [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString() }

# Canonical JSON body (compact; matches your Lambda expectations)
$keyPath = "sources/hello.txt"
$bodyObj = @{
  key                = $keyPath
  contentType        = "text/plain"
  contentDisposition = 'attachment; filename="hello.txt"'
  sse                = "AES256"
  checksum           = "crc32"
}
$body = ($bodyObj | ConvertTo-Json -Compress)

# Build signature over "ts.body"
$ts       = NowTs
$payload  = "$ts.$body"
$secretBs = HexToBytes $SECRET
$sig      = HmacHex $secretBs $payload

Write-Host "`n--- Presign request debug ---"
Write-Host "ts: $ts"
Write-Host "body: $body"
Write-Host "sig(hex): $sig"
Write-Host "-----------------------------`n"

# Single HttpClient for all steps
$client = [System.Net.Http.HttpClient]::new()
$client.Timeout = [TimeSpan]::FromSeconds(30)
$client.DefaultRequestHeaders.UserAgent.ParseAdd("lifebook-ci/1.0")

try {
  # Wrap presign in a small function so we can retry on 502
  function Invoke-Presign {
    param([string]$endpoint,[string]$body,[string]$ts,[string]$sig,[string]$apiKey)

    $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, $endpoint)
    $req.Content = [System.Net.Http.StringContent]::new($body, [Text.Encoding]::UTF8, "application/json")
    $req.Headers.Add("x-api-key",   $apiKey)
    $req.Headers.Add("x-timestamp", $ts)
    $req.Headers.Add("x-signature", $sig)

    $resp     = $client.SendAsync($req).GetAwaiter().GetResult()
    $code     = [int]$resp.StatusCode
    $respText = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $resp.Dispose()

    return @{ Code=$code; Text=$respText }
  }

  # --- Presign (retry once if 502) ---
  $pre = Invoke-Presign -endpoint $API_BASE -body $body -ts $ts -sig $sig -apiKey $API_KEY
  if ($pre.Code -eq 502) {
    Write-Host "Presign returned 502 once; retrying in 2s..."
    Start-Sleep -Seconds 2
    # Use a fresh timestamp + signature on retry (if Lambda is sensitive to ts skew)
    $ts2      = NowTs
    $payload2 = "$ts2.$body"
    $sig2     = HmacHex $secretBs $payload2
    Write-Host "retry ts: $ts2"
    Write-Host "retry sig: $sig2"
    $pre = Invoke-Presign -endpoint $API_BASE -body $body -ts $ts2 -sig $sig2 -apiKey $API_KEY
    $ts = $ts2; $sig = $sig2
  }

  if ($pre.Code -lt 200 -or $pre.Code -ge 300) {
    Write-Host "Presign failed:"
    Write-Host $pre.Text
    throw "Presign HTTP $($pre.Code)"
  }

  $presign   = $pre.Text | ConvertFrom-Json
  $putUrl    = "$($presign.url)"
  $publicUrl = "$($presign.publicUrl)"
  if (-not $putUrl)    { throw "Presign response missing url" }
  if (-not $publicUrl) { throw "Presign response missing publicUrl" }

  Write-Host "Presign OK  → PUT URL length: $($putUrl.Length)"
  Write-Host "Public URL  → $publicUrl"

  # --- PUT object to S3 (headers must match presign inputs) ---
  $putReq = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Put, $putUrl)
  $bytes  = [Text.Encoding]::ASCII.GetBytes("hello Lifebook $(Get-Date -Format s)")
  $putReq.Content = [System.Net.Http.ByteArrayContent]::new($bytes)
  $putReq.Content.Headers.ContentType =
      [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("text/plain")
  $putReq.Content.Headers.Add("content-disposition", 'attachment; filename="hello.txt"')
  $putReq.Headers.Add("x-amz-server-side-encryption", "AES256")

  $putResp = $client.SendAsync($putReq).GetAwaiter().GetResult()
  $putCode = [int]$putResp.StatusCode
  if ($putCode -lt 200 -or $putCode -ge 300) {
    $putText = $putResp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $putResp.Dispose()
    Write-Host "PUT failed ($putCode)"
    Write-Host $putText
    throw "PUT HTTP $putCode"
  }
  $putResp.Dispose()

  # --- Verify via CloudFront (cache-bust) ---
  $checkUrl = "$publicUrl?ts=$(Get-Date -UFormat %s)"
  $chkResp  = $client.GetAsync($checkUrl).GetAwaiter().GetResult()
  $chkCode  = [int]$chkResp.StatusCode
  $chkBody  = $chkResp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $chkResp.Dispose()

  if ($chkCode -lt 200 -or $chkCode -ge 300) {
    Write-Host "Verify failed ($chkCode)"
    Write-Host $chkBody
    throw "Verify HTTP $chkCode"
  }

  Write-Host "SUCCESS ✅  ($chkCode)  $publicUrl"
}
finally {
  if ($client) { $client.Dispose() }
}
