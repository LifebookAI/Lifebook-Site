<# 
  Lifebook: presign + upload smoke (GitHub Actions)
  Requires repo secrets:
    PRESIGN_API_BASE       e.g. https://api.uselifebook.ai/prod
    PRESIGN_API_KEY        64-char API key
    PRESIGN_HMAC_SECRET    HEX string (even length; ideally 128 hex chars = 64 bytes)
    CF_BASE_URL            (optional) e.g. https://files.uselifebook.ai
#>

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail($msg) {
  Write-Error $msg
  exit 1
}

# --- Read inputs from env ---
$Base         = $env:PRESIGN_API_BASE
$ApiKey       = $env:PRESIGN_API_KEY
$SecretHex    = $env:PRESIGN_HMAC_SECRET
$CfBase       = if ($env:CF_BASE_URL) { $env:CF_BASE_URL.TrimEnd('/') } else { "https://files.uselifebook.ai" }

if (-not $Base)      { Fail "Missing PRESIGN_API_BASE" }
if (-not $ApiKey)    { Fail "Missing PRESIGN_API_KEY" }
if (-not $SecretHex) { Fail "Missing PRESIGN_HMAC_SECRET (hex)" }

# --- Validate HEX secret ---
$SecretHex = $SecretHex.Trim()
if ($SecretHex -notmatch '^[0-9a-fA-F]+$') { Fail "PRESIGN_HMAC_SECRET must be HEX (0-9a-f)" }
if ( ($SecretHex.Length % 2) -ne 0 ) { Fail "PRESIGN_HMAC_SECRET length must be even number of hex chars" }

# --- Helpers ---
function HexToBytes([string]$hex) {
  return [System.Convert]::FromHexString($hex)
}
function BytesToLowerHex([byte[]]$bytes) {
  return (-join ($bytes | ForEach-Object { $_.ToString('x2') }))
}

# --- Build request body (compact JSON) ---
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
$rand  = Get-Random
$key   = "sources/smoke-$stamp-$rand.txt"

$bodyObj = [ordered]@{
  key                = $key
  contentType        = "text/plain"
  contentDisposition = "inline"
}
$bodyJson = ($bodyObj | ConvertTo-Json -Compress)

# --- HMAC signature over "$ts.$bodyJson" using HEX-decoded secret ---
$ts      = [int][double]::Parse((Get-Date -Date (Get-Date).ToUniversalTime() -UFormat %s))
$toSign  = "$ts.$bodyJson"
$keyBytes = HexToBytes $SecretHex
$hmac     = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)

$toSignBytes = [System.Text.Encoding]::UTF8.GetBytes($toSign)
$sigBytes    = $hmac.ComputeHash($toSignBytes)
$signature   = BytesToLowerHex $sigBytes

# --- Request presign ---
$headers = @{
  "x-api-key"   = $ApiKey
  "x-timestamp" = $ts
  "x-signature" = $signature
  "content-type"= "application/json"
}

Write-Host "Requesting presign at $Base/presign"
$presign = Invoke-RestMethod -Method POST -Uri "$Base/presign" -Headers $headers -Body $bodyJson

if (-not $presign) { Fail "No response from presign endpoint" }
if (-not $presign.url) { 
  Write-Host ($presign | ConvertTo-Json -Depth 10)
  Fail "Presign response missing 'url'"
}

$putUrl = [string]$presign.url
Write-Host "PUT URL:"
Write-Host $putUrl

# --- Build upload headers; honor any from response ---
$uploadHeaders = @{}
if ($presign.headers) {
  foreach ($p in $presign.headers.PSObject.Properties) {
    $uploadHeaders[$p.Name] = [string]$p.Value
  }
}

if (-not $uploadHeaders["Content-Type"])                { $uploadHeaders["Content-Type"] = "text/plain" }
if (-not $uploadHeaders["Content-Disposition"])         { $uploadHeaders["Content-Disposition"] = "inline" }
if (-not $uploadHeaders["x-amz-server-side-encryption"]) { $uploadHeaders["x-amz-server-side-encryption"] = "AES256" }

# --- Upload via presigned PUT ---
$payload = [System.Text.Encoding]::UTF8.GetBytes("hello smoke $stamp")
Write-Host "Uploading object..."
Invoke-RestMethod -Method PUT -Uri $putUrl -Body $payload -Headers $uploadHeaders | Out-Null
Write-Host "Upload completed."

# --- Derive CloudFront verify URL from S3 key in the PUT URL path ---
$uri = [System.Uri]$putUrl
$keyFromUrl = [System.Net.WebUtility]::UrlDecode($uri.AbsolutePath).TrimStart('/')
$verifyUrl = "$CfBase/$keyFromUrl"

Write-Host "VERIFY URL:"
Write-Host $verifyUrl

# --- Verify fetch from CloudFront ---
Write-Host "Fetching from CloudFront..."
$response = Invoke-WebRequest -Method GET -Uri $verifyUrl
if ($response.StatusCode -ne 200) { Fail "Verify GET failed: HTTP $($response.StatusCode)" }

$content = $response.Content
Write-Host "VERIFY STATUS: $($response.StatusCode)"
Write-Host "VERIFY BODY (up to 120 chars):"
Write-Host ($content.Substring(0, [Math]::Min(120, $content.Length)))

# --- Content sanity check ---
if ($content -notmatch "^hello smoke ") {
  Fail "Verify content mismatch."
}

Write-Host "Smoke test PASSED."
exit 0
