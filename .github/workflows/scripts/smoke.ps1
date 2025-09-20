<# 
  Lifebook: presign + upload smoke (GitHub Actions)
  Hardened: strict header sanitization to remove ALL control/newline chars.
  Secrets required:
    PRESIGN_API_BASE, PRESIGN_API_KEY, PRESIGN_HMAC_SECRET, (optional) CF_BASE_URL
#>

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail([string]$msg) { Write-Error $msg; exit 1 }

# ---------- Helpers ----------
function CleanHeaderStrict([object]$v) {
  if ($null -eq $v) { return "" }
  $s = [string]$v

  # Remove common newline forms and Unicode separators
  $s = $s -replace "[`r`n\u0085\u2028\u2029]", ""

  # Remove ALL control characters (anything < 0x20) and non-ASCII (> 0x7E)
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $s.ToCharArray()) {
    $code = [int][char]$ch
    if ($code -ge 0x20 -and $code -le 0x7E) { [void]$sb.Append($ch) }
  }
  return $sb.ToString().Trim()
}

function HexToBytes([string]$hex) { [System.Convert]::FromHexString($hex) }
function BytesToLowerHex([byte[]]$bytes) { -join ($bytes | ForEach-Object { $_.ToString('x2') }) }

# ---------- Read & sanitize env ----------
$Base      = CleanHeaderStrict($env:PRESIGN_API_BASE).TrimEnd('/')
$ApiKey    = CleanHeaderStrict($env:PRESIGN_API_KEY)
$SecretHex = CleanHeaderStrict($env:PRESIGN_HMAC_SECRET)
$CfBase    = if ($env:CF_BASE_URL) { CleanHeaderStrict($env:CF_BASE_URL).TrimEnd('/') } else { "https://files.uselifebook.ai" }

if (-not $Base)      { Fail "Missing PRESIGN_API_BASE" }
if (-not $ApiKey)    { Fail "Missing PRESIGN_API_KEY (check for stray newline/space)" }
if (-not $SecretHex) { Fail "Missing PRESIGN_HMAC_SECRET (hex)" }
if ($SecretHex -notmatch '^[0-9a-fA-F]+$') { Fail "PRESIGN_HMAC_SECRET must be HEX (0-9a-f)" }
if ( ($SecretHex.Length % 2) -ne 0 )       { Fail "PRESIGN_HMAC_SECRET length must be even number of hex chars" }

# ---------- Build compact JSON body ----------
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
$rand  = Get-Random
$key   = "sources/smoke-$stamp-$rand.txt"

$bodyObj = [ordered]@{
  key                = $key
  contentType        = "text/plain"
  contentDisposition = "inline"
}
$bodyJson = ($bodyObj | ConvertTo-Json -Compress)

# ---------- HMAC signature over "$ts.$bodyJson" ----------
$ts       = [System.DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$toSign   = "$ts.$bodyJson"
$keyBytes = HexToBytes $SecretHex
$hmac     = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)
$sigBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($toSign))
$signature= BytesToLowerHex $sigBytes

# ---------- Strict, typed headers dictionary ----------
$headers = New-Object "System.Collections.Generic.Dictionary[[string],[string]]"
$headers.Add("x-api-key",   CleanHeaderStrict($ApiKey))
$headers.Add("x-timestamp", CleanHeaderStrict([string]$ts))
$headers.Add("x-signature", CleanHeaderStrict($signature))

Write-Host "Requesting *** at ***"
try {
  $presign = Invoke-RestMethod -Method POST -Uri "$Base/presign" -Headers $headers -Body $bodyJson -ContentType 'application/json'
} catch {
  # Helpful hint if the runner still thinks headers have newlines
  Write-Host "Header lengths — api-key:$((CleanHeaderStrict($ApiKey)).Length) ts:$(([string]$ts).Length) sig:$((CleanHeaderStrict($signature)).Length))"
  throw
}

if (-not $presign)     { Fail "No response from presign endpoint" }
if (-not $presign.url) { Write-Host ($presign | ConvertTo-Json -Depth 10); Fail "Presign response missing 'url'" }

$putUrl = [string]$presign.url
Write-Host "PUT URL:"
Write-Host $putUrl

# ---------- Upload headers; honor any returned (sanitize all) ----------
$uploadHeaders = @{}
if ($presign.headers) {
  foreach ($p in $presign.headers.PSObject.Properties) {
    $uploadHeaders[$p.Name] = CleanHeaderStrict([string]$p.Value)
  }
}
if (-not $uploadHeaders["Content-Type"])                 { $uploadHeaders["Content-Type"] = "text/plain" }
if (-not $uploadHeaders["Content-Disposition"])          { $uploadHeaders["Content-Disposition"] = "inline" }
if (-not $uploadHeaders["x-amz-server-side-encryption"]) { $uploadHeaders["x-amz-server-side-encryption"] = "AES256" }

# ---------- PUT upload ----------
$payload = [System.Text.Encoding]::UTF8.GetBytes("hello smoke $stamp")
Write-Host "Uploading object..."
Invoke-RestMethod -Method PUT -Uri $putUrl -Body $payload -Headers $uploadHeaders | Out-Null
Write-Host "Upload completed."

# ---------- Derive verify URL and fetch ----------
$uri = [System.Uri]$putUrl
$keyFromUrl = [System.Net.WebUtility]::UrlDecode($uri.AbsolutePath).TrimStart('/')
$verifyUrl = "$CfBase/$keyFromUrl"

Write-Host "VERIFY URL:"
Write-Host $verifyUrl

$response = Invoke-WebRequest -Method GET -Uri $verifyUrl
if ($response.StatusCode -ne 200) { Fail "Verify GET failed: HTTP $($response.StatusCode)" }

$content = $response.Content
Write-Host "VERIFY STATUS: $($response.StatusCode)"
Write-Host "VERIFY BODY (up to 120 chars):"
Write-Host ($content.Substring(0, [Math]::Min(120, $content.Length)))

if ($content -notmatch "^hello smoke ") { Fail "Verify content mismatch." }

Write-Host "Smoke test PASSED."
exit 0
