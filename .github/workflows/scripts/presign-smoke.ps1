# scripts/presign-smoke.ps1 — CI presign + PUT + verify

$ErrorActionPreference = "Stop"

function HmacHex([string]$secret, [string]$payload) {
  $h = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))
  $b = $h.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload))
  ([BitConverter]::ToString($b) -replace '-', '').ToLower()
}

$api    = $env:PRESIGN_API_BASE
$key    = $env:PRESIGN_API_KEY
$secret = $env:PRESIGN_HMAC_SECRET
if (-not $api -or -not $key -or -not $secret) { throw "Missing env: PRESIGN_API_BASE / PRESIGN_API_KEY / PRESIGN_HMAC_SECRET" }

$ts   = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
$body = '{"key":"sources/hello.txt","contentType":"text/plain","contentDisposition":"attachment; filename=\"hello.txt\""}'
$sig  = HmacHex $secret "$ts.$body"

$headers = @{
  "content-type" = "application/json"
  "x-api-key"    = $key
  "x-timestamp"  = $ts
  "x-signature"  = $sig
}

# Ask for a presign
try {
  $resp = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $api -Headers $headers -Body $body -ErrorAction Stop
  $json = $resp.Content | ConvertFrom-Json
} catch {
  Write-Host "Presign failed:`n$($_.Exception.Message)"
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  throw
}

$putUrl = $json.url
$pubUrl = $json.publicUrl
$sse    = $json.sse

# Create a tiny file to upload
$tmp = Join-Path $env:TEMP "hello.txt"
"hello Lifebook $(Get-Date -Format o)" | Set-Content -Encoding ASCII $tmp

# PUT with exact headers S3 expects (and SSE if provided)
$curl = @("curl.exe","--fail","-sS","--http1.1","-X","PUT",$putUrl,
          "-H","content-type: text/plain",
          "-H","content-disposition: attachment; filename=hello.txt")
if ($sse -eq "AES256") { $curl += @("-H","x-amz-server-side-encryption: AES256") }
$curl += @("--upload-file",$tmp)

$proc = Start-Process -FilePath $curl[0] -ArgumentList $curl[1..($curl.Length-1)] -NoNewWindow -PassThru -Wait
if ($proc.ExitCode -ne 0) { throw "PUT failed with exit code $($proc.ExitCode)" }

# Verify via CloudFront
$head = (curl.exe -I -sS "$pubUrl") -join "`n"
if ($LASTEXITCODE -ne 0) { throw "CloudFront HEAD failed" }
Write-Host $head

Write-Host "OK"
