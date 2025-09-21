# -------------------------
# VERIFY via CloudFront (no bucket segment)
# -------------------------
$cfBase = $env:CF_BASE_URL
if (-not $cfBase) { throw "CF_BASE_URL env var is required (e.g. https://files.uselifebook.ai)" }
$cfBase   = $cfBase.TrimEnd('/')
$keyPath  = $key.TrimStart('/')           # key is like "sources/smoke-....txt"
$verifyUrl = "$cfBase/$keyPath"

Write-Host "VERIFY URL : $verifyUrl"
try {
  $response2 = Invoke-WebRequest -Uri $verifyUrl -Method GET -Headers @{ 'Cache-Control'='no-cache' } -ErrorAction Stop
} catch {
  # Surface the real 4xx/5xx body
  if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream) {
    $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $body = $sr.ReadToEnd()
    throw "Verify GET failed: HTTP $($_.Exception.Response.StatusCode) Body: $body"
  }
  throw
}

if ($response2.StatusCode -ne 200) { throw "Verify GET failed: HTTP $($response2.StatusCode)" }
if ($response2.Content -notmatch '^hello smoke ') {
  throw "Verify content mismatch: $($response2.Content.Substring(0, [Math]::Min(120, $response2.Content.Length)))"
}
Write-Host "VERIFY OK."
