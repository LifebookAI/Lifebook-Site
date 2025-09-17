# presign-smoke.ps1 — GitHub Actions friendly (PowerShell 7)
# Uses env: API_BASE, API_KEY, SECRET

$ErrorActionPreference = 'Stop'

# --- Inputs (masked in Actions logs) ---
$api     = $env:API_BASE
$key     = $env:API_KEY
$secret  = $env:SECRET

Write-Host "API_BASE length: $($api.Length)"
Write-Host "API_KEY  length: $($key.Length)"
Write-Host "SECRET  length: $($secret.Length)"

if ([string]::IsNullOrWhiteSpace($api) -or
    [string]::IsNullOrWhiteSpace($key) -or
    [string]::IsNullOrWhiteSpace($secret)) {
  Write-Error "Missing one or more required env vars: API_BASE, API_KEY, SECRET"
  exit 1
}

# --- Canonical JSON body (no extra spaces/newlines) ---
# Keep this EXACTLY in sync with your Next.js request body
$body = '{"key":"sources/hello.txt","contentType":"text/plain","contentDisposition":"attachment; filename=\"hello.txt\""}'

# --- Timestamp for HMAC ---
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()

# --- HMAC (hex, lowercase) ---
function Get-HmacHex([string]$k, [string]$payload) {
  $h = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($k))
  $bytes = $h.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload))
  ([BitConverter]::ToString($bytes)).Replace('-','').ToLower()
}

# Sign "<ts>.<body>"
$sig = Get-HmacHex $secret "$ts.$body"

# --- Call presign endpoint ---
$headers = @{
  'content-type' = 'application/json'
  'x-api-key'    = $key
  'x-timestamp'  = $ts
  'x-signature'  = $sig
}

try {
  $resp = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $api -Headers $headers -Body $body -ErrorAction Stop
  Write-Host "Presign HTTP: $($resp.StatusCode)"
  $res  = $resp.Content | ConvertFrom-Json
} catch {
  Write-Host "Presign failed:"
  # In pwsh 7, .Response is HttpResponseMessage (no GetResponseStream); read Content correctly.
  $hrm = $_.Exception.Response
  if ($hrm -and $hrm.Content) {
    $code = [int]$hrm.StatusCode
    $text = $hrm.Content.ReadAsStringAsync().Result
    Write-Host "HTTP: $code"
    Write-Host $text
  } else {
    Write-Host "No HTTP response: $($_.Exception.Message)"
  }
  exit 1
}

# --- Extract URLs from JSON ---
$putUrl = $res.url
$pubUrl = $res.publicUrl

if ([string]::IsNullOrWhiteSpace($putUrl) -or [string]::IsNullOrWhiteSpace($pubUrl)) {
  Write-Error "Presign JSON missing url/publicUrl"; exit 1
}

Write-Host "PUT URL length : $($putUrl.Length)"
Write-Host "Public URL     : $pubUrl"

# --- Create a tiny file to upload ---
$tmp = Join-Path $env:TEMP ("hello-" + [Guid]::NewGuid().ToString("n") + ".txt")
"hello Lifebook $(Get-Date -Format o)" | Set-Content -Encoding ASCII $tmp

# --- PUT the object (headers must match what presign expects) ---
# If your Lambda sets 'sse': 'AES256', keep the SSE header; if it uses KMS, switch to the KMS headers instead.
$http = & curl.exe --silent --show-error --fail `
  -X PUT "$putUrl" `
  -H "content-type: text/plain" `
  -H "content-disposition: attachment; filename=hello.txt" `
  -H "x-amz-server-side-encryption: AES256" `
  --upload-file "$tmp" `
  -w "HTTP:%{http_code}`n"

Write-Host $http
if ($LASTEXITCODE -ne 0 -or ($http -notmatch 'HTTP:(200|201|204)')) {
  Write-Error "PUT failed"; exit 1
}

# --- Verify via CloudFront (HEAD first, then GET for fresh content) ---
$head = & curl.exe -I --silent --show-error "$pubUrl"
Write-Host $head
$bodyOut = & curl.exe --silent "$($pubUrl)?v=$(Get-Date -UFormat %s)"
Write-Host $bodyOut

Write-Host "Smoke test: OK"
