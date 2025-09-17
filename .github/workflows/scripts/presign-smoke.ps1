# presign-smoke.ps1  — robust against stray CR/LF in env/headers

# 0) Read env + sanitize so headers NEVER contain CR/LF or spaces
$API_BASE = ($env:API_BASE  -as [string]).Trim() -replace "`r|`n",""
$API_KEY  = ($env:API_KEY   -as [string]).Trim() -replace "`r|`n",""
$SECRET   = ($env:SECRET    -as [string]).Trim() -replace "`r|`n",""

Write-Host "API_BASE length: $($API_BASE.Length)"
Write-Host "API_KEY  length: $($API_KEY.Length)"
Write-Host "SECRET  length: $($SECRET.Length)"

if (-not $API_BASE -or -not $API_KEY -or -not $SECRET) {
  throw "Missing one or more required env vars: API_BASE, API_KEY, SECRET"
}

# 1) Canonical JSON (no extra whitespace/newlines)
$body = '{"key":"sources/hello.txt","contentType":"text/plain","contentDisposition":"attachment; filename=\"hello.txt\""}'

# 2) Timestamp (epoch seconds as string)
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()

# 3) Compute HMAC-SHA256 over "<ts>.<body>" and return HEX (lowercase)
function Get-HmacHex([string]$secret, [string]$payload) {
  $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))
  $hashBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload))
  ([BitConverter]::ToString($hashBytes)).Replace('-','').ToLowerInvariant()
}
$sig = Get-HmacHex $SECRET "$ts.$body"

# 4) Build headers using a typed dictionary (avoids odd PS header coercions)
$headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]"
$headers["content-type"] = "application/json"
$headers["x-api-key"]    = $API_KEY
$headers["x-timestamp"]  = $ts
$headers["x-signature"]  = $sig

# 5) Call the presign endpoint and always print status + content
try {
  $resp = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $API_BASE -Headers $headers -Body $body -ErrorAction Stop
  Write-Host ("PRESIGN STATUS: {0}" -f $resp.StatusCode)
  $json = $resp.Content | ConvertFrom-Json
} catch {
  # On HTTP error, Write out cleanly (ResponseMessage in pwsh has .Content)
  $http = $_.Exception.Response
  if ($http -and $http.Content) {
    Write-Host "Presign failed:"
    Write-Host ($http.Content.ReadAsStringAsync().GetAwaiter().GetResult())
  } else {
    Write-Host "No HTTP response: $($_.Exception.Message)"
  }
  exit 1
}

# 6) If you want to stop after presign succeeds, uncomment next line:
# exit 0

# ---- Optional: PUT + verify (kept minimal and robust) ----
$putUrl = $json.url
$pubUrl = $json.publicUrl

# Small temp file to upload
$tmp = Join-Path $env:TEMP ("hello-" + [guid]::NewGuid().ToString("N") + ".txt")
"hello Lifebook from CI $(Get-Date -AsUTC)" | Set-Content -NoNewline -Encoding ASCII $tmp

# S3 expects these headers to match what your presigner used
$putStatus = & curl.exe -s -o NUL -w "%{http_code}" -X PUT `
  -H "content-type: text/plain" `
  -H "content-disposition: attachment; filename=hello.txt" `
  -H "x-amz-server-side-encryption: AES256" `
  --upload-file "$tmp" "$putUrl"

Write-Host "PUT STATUS: $putStatus"

# Verify via CloudFront (cache-bust)
$verify = & curl.exe -s -I "${pubUrl}?v=$(Get-Date -UFormat %s)"
Write-Host $verify

# Fetch contents for sanity
$bodyOut = & curl.exe -s "$pubUrl"
Write-Host "Public content:"
Write-Host $bodyOut
