# .github/workflows/scripts/presign-smoke.ps1
# Presign -> PUT to S3 -> verify via CloudFront

# ---------------- helpers ----------------
function Clean([string]$s) {
  if ($null -eq $s) { return "" }
  # remove CR/LF and all ASCII control chars (incl. \x00-\x1F and \x7F)
  $t = $s -replace "`r","" -replace "`n",""
  $t = $t -replace '[\x00-\x1F\x7F]', ''
  return $t.Trim()
}

function SigHex([string]$secret, [string]$payload) {
  $h = New-Object System.Security.Cryptography.HMACSHA256
  $h.Key = [Text.Encoding]::UTF8.GetBytes($secret)
  $bytes = $h.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload))
  -join ($bytes | ForEach-Object { $_.ToString("x2") })
}

# ---------------- inputs -----------------
$API_BASE = Clean $env:PRESIGN_API_BASE
$API_KEY  = Clean $env:PRESIGN_API_KEY
$SECRET   = Clean $env:PRESIGN_HMAC_SECRET

if (-not $API_BASE -or -not $API_KEY -or -not $SECRET) {
  Write-Error "Missing PRESIGN_API_BASE, PRESIGN_API_KEY, or PRESIGN_HMAC_SECRET"
  exit 1
}

Write-Host ("API_BASE length: {0}" -f $API_BASE.Length)
Write-Host ("API_KEY  length: {0}" -f $API_KEY.Length)
Write-Host ("SECRET  length: {0}" -f $SECRET.Length)

# canonical body (used for both signing and POST)
$key  = "sources/hello.txt"
$body = (@{ key = $key } | ConvertTo-Json -Compress)

$ts   = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
$sig  = SigHex $SECRET "$ts.$body"

$headers = @{
  "x-api-key"   = $API_KEY
  "x-timestamp" = $ts
  "x-signature" = $sig
}

# quick header validation to catch hidden control chars
foreach ($kv in $headers.GetEnumerator()) {
  if ($kv.Value -match '[\x00-\x1F\x7F]') {
    Write-Error ("Header {0} contains control characters" -f $kv.Key)
    exit 1
  }
}

# ---------------- presign ----------------
try {
  $resp = Invoke-WebRequest `
    -UseBasicParsing -Method POST -Uri $API_BASE `
    -Headers $headers -Body $body -ContentType "application/json"
} catch {
  if ($_.Exception.Response) {
    $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Error ("Presign failed: " + $sr.ReadToEnd())
  } else {
    Write-Error ("Presign failed: " + $_.Exception.Message)
  }
  exit 1
}

$res    = $resp.Content | ConvertFrom-Json
$putUrl = $res.url
$pubUrl = $res.publicUrl
$sse    = $res.sse

if (-not $putUrl -or -not $pubUrl) {
  Write-Error "Presign response missing url/publicUrl: $($resp.Content)"
  exit 1
}

# stash the public URL for the next step (optional)
"$pubUrl" | Set-Content -Encoding ASCII "$env:TEMP\presign-url.txt"

# ---------------- upload to S3 ----------------
$tmp = Join-Path $env:TEMP "hello.txt"
"hello from actions $(Get-Date -AsUTC)" | Set-Content -Encoding ASCII $tmp

$cmd = @('curl.exe','-sS','--http1.1','-X','PUT', $putUrl,
         '-H','content-type: text/plain')

if ($sse -eq 'AES256') {
  $cmd += @('-H','x-amz-server-side-encryption: AES256')
}

$cmd += @('--upload-file', $tmp, '-w','HTTP:%{http_code}`n')

$putOut = & $cmd[0] $cmd[1..($cmd.Length-1)]
$putOut
if ($putOut -notmatch 'HTTP:200') {
  Write-Error "PUT failed"
  exit 1
}

# ---------------- verify via CloudFront ----------------
$head = & 'curl.exe' '-sS' '-I' $pubUrl
$head
if ($head -notmatch 'HTTP/1.1 200 OK') {
  Write-Error "Verify via CloudFront failed"
  exit 1
}

Write-Host "OK: $pubUrl"
