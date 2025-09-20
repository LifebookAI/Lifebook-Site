<# Lifebook: presign + upload smoke (GitHub Actions) #>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail([string]$msg){ Write-Error $msg; exit 1 }

# --- Helpers ---
function CleanHeaderStrict([object]$v){
  if ($null -eq $v) { return "" }
  $s = [string]$v
  $s = $s -replace "[`r`n\u0085\u2028\u2029]", ""     # remove all newline kinds
  $sb = New-Object System.Text.StringBuilder
  foreach($ch in $s.ToCharArray()){
    $code = [int][char]$ch
    if ($code -ge 0x20 -and $code -le 0x7E) { [void]$sb.Append($ch) }  # ASCII printable only
  }
  $sb.ToString().Trim()
}
function HexToBytes([string]$hex){ [System.Convert]::FromHexString($hex) }
function BytesToLowerHex([byte[]]$bytes){ -join ($bytes | ForEach-Object { $_.ToString('x2') }) }

# --- Env (sanitized) ---
$Base      = CleanHeaderStrict($env:PRESIGN_API_BASE).TrimEnd('/')
$ApiKey    = CleanHeaderStrict($env:PRESIGN_API_KEY)
$SecretHex = CleanHeaderStrict($env:PRESIGN_HMAC_SECRET)
$CfBase    = if ($env:CF_BASE_URL){ CleanHeaderStrict($env:CF_BASE_URL).TrimEnd('/') } else { "https://files.uselifebook.ai" }

if (-not $Base){ Fail "Missing PRESIGN_API_BASE" }
if (-not $ApiKey){ Fail "Missing PRESIGN_API_KEY" }
if (-not $SecretHex){ Fail "Missing PRESIGN_HMAC_SECRET" }
if ($SecretHex -notmatch '^[0-9a-fA-F]+$'){ Fail "PRESIGN_HMAC_SECRET must be hex" }
if (($SecretHex.Length % 2) -ne 0){ Fail "PRESIGN_HMAC_SECRET length must be even" }

# --- Body ---
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
$rand  = Get-Random
$key   = "sources/smoke-$stamp-$rand.txt"
$bodyObj = [ordered]@{
  key                = $key
  contentType        = "text/plain"
  contentDisposition = "inline"
}
$bodyJson = $bodyObj | ConvertTo-Json -Compress

# --- HMAC: "$ts.$bodyJson" ---
$ts       = [System.DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$toSign   = "$ts.$bodyJson"
$keyBytes = HexToBytes $SecretHex
$hmac     = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)
$sigBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($toSign))
$signature= BytesToLowerHex $sigBytes

# --- Headers (hashtable; no .Add()) ---
$headers = @{
  "x-api-key"   = $ApiKey
  "x-timestamp" = [string]$ts
  "x-signature" = $signature
}

Write-Host "Requesting presign..."
$presign = Invoke-RestMethod -Method POST -Uri "$Base/presign" -Headers $headers -Body $bodyJson -ContentType 'application/json'

if (-not $presign){ Fail "No response from presign endpoint" }
if (-not $presign.url){ Write-Host ($presign | ConvertTo-Json -Depth 10); Fail "Presign response missing 'url'" }

$putUrl = [string]$presign.url
Write-Host "PUT URL:`n$putUrl"

# --- Upload headers (sanitize, with sane defaults) ---
$uploadHeaders = @{}
if ($presign.headers){
  foreach($p in $presign.headers.PSObject.Properties){
    $uploadHeaders[$p.Name] = CleanHeaderStrict([string]$p.Value)
  }
}
if (-not $uploadHeaders['Content-Type'])                 { $uploadHeaders['Content-Type'] = 'text/plain' }
if (-not $uploadHeaders['Content-Disposition'])          { $uploadHeaders['Content-Disposition'] = 'inline' }
if (-not $uploadHeaders['x-amz-server-side-encryption']){ $uploadHeaders['x-amz-server-side-encryption'] = 'AES256' }

# --- Upload ---
$payload = [System.Text.Encoding]::UTF8.GetBytes("hello smoke $stamp")
Write-Host "Uploading..."
Invoke-RestMethod -Method PUT -Uri $putUrl -Body $payload -Headers $uploadHeaders | Out-Null
Write-Host "Upload complete."

# --- Verify via CloudFront ---
$uri = [System.Uri]$putUrl
$keyFromUrl = [System.Net.WebUtility]::UrlDecode($uri.AbsolutePath).TrimStart('/')
$verifyUrl = "$CfBase/$keyFromUrl"
Write-Host "VERIFY URL:`n$verifyUrl"

$response = Invoke-WebRequest -Method GET -Uri $verifyUrl
if ($response.StatusCode -ne 200){ Fail "Verify GET failed: HTTP $($response.StatusCode)" }

$content = $response.Content
Write-Host "VERIFY STATUS: $($response.StatusCode)"
Write-Host "VERIFY BODY (first 120):"
Write-Host ($content.Substring(0, [Math]::Min(120, $content.Length)))

if ($content -notmatch '^hello smoke '){ Fail 'Verify content mismatch' }

Write-Host "Smoke test PASSED."
exit 0
