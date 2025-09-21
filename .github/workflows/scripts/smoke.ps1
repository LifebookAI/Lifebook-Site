# .github/workflows/scripts/smoke.ps1
$ErrorActionPreference = 'Stop'

# --- Inputs from workflow env ---
$base    = $env:PRESIGN_API_BASE
$apiKey  = $env:PRESIGN_API_KEY
$secret  = $env:PRESIGN_HMAC_SECRET
$cfBase  = $env:CF_BASE_URL

if (-not $base)   { throw "PRESIGN_API_BASE env var is required" }
if (-not $secret) { throw "PRESIGN_HMAC_SECRET env var is required" }
if (-not $cfBase) { throw "CF_BASE_URL env var is required" }

$base  = $base.TrimEnd('/')
$cfBase= $cfBase.TrimEnd('/')

# --- Helpers ---
function Convert-HexToBytes([string]$hex) {
  if ($hex.Length % 2 -ne 0) { throw "HMAC secret must be even-length hex" }
  $bytes = New-Object byte[] ($hex.Length/2)
  for ($i=0; $i -lt $bytes.Length; $i++) {
    $bytes[$i] = [byte]::Parse($hex.Substring($i*2,2), [System.Globalization.NumberStyles]::HexNumber)
  }
  return $bytes
}

# --- Build object key and body we will sign ---
$ts   = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$rand = -join ((48..57 + 97..122) | Get-Random -Count 12 | % { [char]$_ })
$key  = "sources/smoke-$ts-$rand.txt"

$bodyObj  = @{ key = $key; contentType = "text/plain"; contentDisposition = "inline" }
$bodyJson = (ConvertTo-Json $bodyObj -Compress)

# --- Compute HMAC of "<ts>.<bodyJson>" using hex secret ---
$kbytes = Convert-HexToBytes $secret
$toSign = "$ts.$bodyJson"
$hmac   = [System.Security.Cryptography.HMACSHA256]::new($kbytes)
try {
  $sigBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($toSign))
} finally {
  $hmac.Dispose()
}
$sig = -join ($sigBytes | % { $_.ToString('x2') })

Write-Host "DEBUG base        : $base"
Write-Host "DEBUG ts          : $ts"
Write-Host "DEBUG bodyJson    : $bodyJson"
Write-Host "DEBUG toSign(head):  $toSign"
Write-Host "DEBUG sig         : $sig"
Write-Host "DEBUG keyBytesLen : $($kbytes.Length)"
Write-Host "DEBUG apiKeyLen   : $((if ($apiKey){$apiKey.Length}else{0}))"

# --- Request presign ---
$headers = @{ 'x-timestamp' = "$ts"; 'x-signature' = $sig }
if ($apiKey) { $headers['x-api-key'] = $apiKey }

$presignUrl = "$base/presign"
Write-Host "Trying PRESIGN URL: $presignUrl"

try {
  $presign = Invoke-RestMethod -Method POST -Uri $presignUrl -Headers $headers -ContentType 'application/json' -Body $bodyJson -ErrorAction Stop
} catch {
  $resp = $_.Exception.Response
  if ($resp -and $resp.GetResponseStream) {
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $errBody = $sr.ReadToEnd()
    throw "Presign failed with HTTP $($resp.StatusCode). Body: $errBody"
  }
  throw
}

if (-not $presign.url) { throw "No URL in presign response" }
Write-Host "PRESIGN OK via: $presignUrl"
Write-Host "PUT URL: "
Write-Host $presign.url

# --- Upload the file to S3 with the returned headers ---
$content    = "hello smoke at $ts`n"
$uploadBody = [System.Text.Encoding]::UTF8.GetBytes($content)

$putHeaders = @{}
# presign.headers may be PSCustomObject; normalize to hashtable
if ($presign.headers) {
  $presign.headers.PSObject.Properties | % { $putHeaders[$_.Name] = "$($_.Value)" }
}

try {
  $putResp = Invoke-WebRequest -Method PUT -Uri $presign.url -Headers $putHeaders -Body $uploadBody -ErrorAction Stop
} catch {
  $resp = $_.Exception.Response
  if ($resp -and $resp.GetResponseStream) {
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $errBody = $sr.ReadToEnd()
    throw "Upload PUT failed: HTTP $($resp.StatusCode) Body: $errBody"
  }
  throw
}
Write-Host "Uploading..."
Write-Host "Upload complete."

# --- VERIFY via CloudFront (no bucket segment in path) ---
$keyPath   = $key.TrimStart('/')      # key like "sources/smoke-....txt"
$verifyUrl = "$cfBase/$keyPath"
Write-Host "VERIFY URL : $verifyUrl"

try {
  $response2 = Invoke-WebRequest -Uri $verifyUrl -Method GET -Headers @{ 'Cache-Control'='no-cache' } -ErrorAction Stop
} catch {
  $resp = $_.Exception.Response
  if ($resp -and $resp.GetResponseStream) {
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $errBody = $sr.ReadToEnd()
    throw "Verify GET failed: HTTP $($resp.StatusCode) Body: $errBody"
  }
  throw
}

if ($response2.StatusCode -ne 200) { throw "Verify GET failed: HTTP $($response2.StatusCode)" }
if ($response2.Content -notmatch '^hello smoke ') {
  $snippet = $response2.Content.Substring(0, [Math]::Min(120, $response2.Content.Length))
  throw "Verify content mismatch: $snippet"
}
Write-Host "VERIFY OK."
