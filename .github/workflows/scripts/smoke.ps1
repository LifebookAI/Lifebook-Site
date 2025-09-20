<# Lifebook: presign + upload smoke (auto stage toggle, PS7-safe) #>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail([string]$msg){ Write-Error $msg; exit 1 }

# --- Helpers ---
function CleanHeaderStrict([object]$v){
  if ($null -eq $v) { return "" }
  $s = [string]$v
  $s = $s -replace "[`r`n\u0085\u2028\u2029]", ""   # strip any newline type
  $sb = New-Object System.Text.StringBuilder
  foreach($ch in $s.ToCharArray()){
    $code = [int][char]$ch
    if ($code -ge 0x20 -and $code -le 0x7E) { [void]$sb.Append($ch) } # printable ASCII only
  }
  $sb.ToString().Trim()
}
function HexToBytes([string]$hex){ [System.Convert]::FromHexString($hex) }
function BytesToLowerHex([byte[]]$bytes){ -join ($bytes | ForEach-Object { $_.ToString('x2') }) }

# --- Read env (with fallbacks) ---
$BaseCandidates = @(
  $env:PRESIGN_API_BASE,
  $env:PRESIGN_ENDPOINT,
  $env:PRESIGN_BASE
) | Where-Object { $_ -and $_.Trim() -ne "" }

$Base = ""
foreach($cand in $BaseCandidates){
  $Base = CleanHeaderStrict($cand).TrimEnd('/')
  if ($Base) { break }
}

$ApiKey    = CleanHeaderStrict($env:PRESIGN_API_KEY)
$SecretHex = CleanHeaderStrict($env:PRESIGN_HMAC_SECRET)
$CfBase    = if ($env:CF_BASE_URL){ CleanHeaderStrict($env:CF_BASE_URL).TrimEnd('/') } else { "https://files.uselifebook.ai" }

if (-not $Base) { Fail "Missing base URL. Set repo secret PRESIGN_API_BASE e.g. https://api.uselifebook.ai/prod or https://api.uselifebook.ai" }
if ($Base -notmatch '^https?://'){ Fail "PRESIGN_API_BASE must start with http(s)://" }
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

# --- Headers ---
$headers = @{
  "x-api-key"   = $ApiKey
  "x-timestamp" = [string]$ts
  "x-signature" = $signature
}

# --- Debug (safe) ---
Write-Host "DEBUG base        : $Base"
Write-Host "DEBUG ts          : $ts"
Write-Host "DEBUG bodyJson    : $bodyJson"
Write-Host "DEBUG toSign(head): " + $toSign.Substring(0, [Math]::Min(160, $toSign.Length))
Write-Host "DEBUG sig         : $signature"
Write-Host "DEBUG keyBytesLen : $($keyBytes.Length)"
Write-Host "DEBUG apiKeyLen   : $($ApiKey.Length)"

# --- Build candidate presign URLs (handles custom-domain mapping with/without /prod) ---
$normBase = $Base.TrimEnd('/')
$candidates = New-Object System.Collections.Generic.List[string]
$candidates.Add("$normBase/presign")
if ($normBase -match '/prod$') {
  $candidates.Add( ($normBase -replace '/prod$','') + '/presign' )
} else {
  $candidates.Add( "$normBase/prod/presign" )
}

# ensure uniqueness & no double slashes
$candidates = ($candidates | ForEach-Object { ($_ -replace '//+', '/') -replace '^https:/','https://' -replace '^http:/','http://' } | Select-Object -Unique)

# --- Try candidates until one 2xx succeeds ---
$presign = $null
$chosen  = $null
foreach($u in $candidates){
  Write-Host "Trying PRESIGN URL: $u"
  $resp = Invoke-WebRequest -Method POST -Uri $u -Headers $headers -Body $bodyJson -ContentType 'application/json' -SkipHttpErrorCheck
  $status = [int]$resp.StatusCode
  if ($status -ge 200 -and $status -lt 300) {
    $presign = $resp.Content | ConvertFrom-Json -Depth 10
    $chosen = $u
    break
  } else {
    Write-Host "Candidate failed ($status): $($resp.Content)"
    if ($status -ne 403 -and $status -ne 404) {
      # not a simple routing error; bail early
      Fail "Presign failed with HTTP $status. Body: $($resp.Content)"
    }
  }
}

if (-not $presign){ 
  Fail ("All presign candidates failed. Tried:`n - " + ($candidates -join "`n - "))
}

Write-Host "PRESIGN OK via: $chosen"
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

# --- Upload via presigned PUT ---
$payload = [System.Text.Encoding]::UTF8.GetBytes("hello smoke $stamp")
Write-Host "Uploading..."
Invoke-RestMethod -Method PUT -Uri $putUrl -Body $payload -Headers $uploadHeaders | Out-Null
Write-Host "Upload complete."

# --- Verify via CloudFront ---
$uri = [System.Uri]$putUrl
$keyFromUrl = [System.Net.WebUtility]::UrlDecode($uri.AbsolutePath).TrimStart('/')
$verifyUrl = "$CfBase/$keyFromUrl"
Write-Host "VERIFY URL:`n$verifyUrl"

$response2 = Invoke-WebRequest -Method GET -Uri $verifyUrl -SkipHttpErrorCheck
if ([int]$response2.StatusCode -ne 200){ Fail "Verify GET failed: HTTP $($response2.StatusCode) Body: $($response2.Content)" }

$content = $response2.Content
Write-Host "VERIFY STATUS: $($response2.StatusCode)"
Write-Host "VERIFY BODY (first 120):"
Write-Host ($content.Substring(0, [Math]::Min(120, $content.Length)))

if ($content -notmatch '^hello smoke '){ Fail 'Verify content mismatch' }

Write-Host "Smoke test PASSED."
exit 0
