<# 
  presign-smoke.ps1
  Calls your /presign endpoint with a tiny test request.
  Works whether you use API Key and/or optional HMAC headers.

  Required env:
    PRESIGN_API_BASE      -> e.g. https://l6571skkfi.execute-api.us-east-1.amazonaws.com/prod
  Optional env:
    PRESIGN_ENDPOINT      -> defaults to /presign
    PRESIGN_API_KEY       -> if your API Gateway uses an API Key
    PRESIGN_HMAC_SECRET   -> if your Lambda verifies HMAC(ts + "." + rawBody)

  Output: dumps status + response body; throws on non-2xx with the HTTP code.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host '***_smoke.ps1 starting...'

# --- read envs ---
$apiBase     = $env:PRESIGN_API_BASE
$endpoint    = if ($env:PRESIGN_ENDPOINT) { $env:PRESIGN_ENDPOINT } else { "/presign" }
$apiKey      = $env:PRESIGN_API_KEY
$hmacSecret  = $env:PRESIGN_HMAC_SECRET

# quick visibility (GitHub masks values that match secrets)
Write-Host ("API_BASE length: {0}" -f ($apiBase   ? $apiBase.Length   : 0))
Write-Host ("API_KEY  length: {0}" -f ($apiKey    ? $apiKey.Length    : 0))
Write-Host ("SECRET  length: {0}" -f ($hmacSecret ? $hmacSecret.Length: 0))

# --- required vars check ---
$missing = @()
if ([string]::IsNullOrWhiteSpace($apiBase)) { $missing += 'PRESIGN_API_BASE' }
if ($missing.Count -gt 0) {
  throw ("Missing one or more required env vars: {0}" -f (($missing -join ', ')))
}

# --- build URL ---
$uri = "{0}/{1}" -f $apiBase.TrimEnd('/'), $endpoint.TrimStart('/')

# --- body we send ---
$bodyObj = @{
  sse                = "AES256"
  contentType        = "text/plain"
  contentDisposition = 'attachment; filename="hello.txt"'
  key                = "sources/hello.txt"
  checksum           = "crc32"
}
$bodyJson = $bodyObj | ConvertTo-Json -Depth 5

# --- headers ---
$headers = @{
  "Content-Type" = "application/json"
}
if ($apiKey) { $headers["x-api-key"] = $apiKey }

# Optional HMAC: ts + "." + rawBody (hex lowercase)
if ($hmacSecret) {
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $toSign = "$ts.$bodyJson"
  $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($hmacSecret))
  try {
    $hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign))
  } finally {
    $hmac.Dispose()
  }
  $sig = -join ($hash | ForEach-Object { $_.ToString('x2') })
  $headers["x-lifebook-ts"]        = "$ts"
  $headers["x-lifebook-signature"] = $sig
}

Write-Host '--- Presign request debug ---'
Write-Host "URI: `"$uri`""
Write-Host "Body: $bodyJson"

# --- call API ---
try {
  $resp = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $uri -Headers $headers -Body $bodyJson -TimeoutSec 60
  Write-Host ("Presign status: {0}" -f $resp.StatusCode)
  Write-Host ("Presign body: {0}" -f $resp.Content)

  # If the response is JSON and contains a URL, surface it nicely
  try {
    $json = $resp.Content | ConvertFrom-Json -ErrorAction Stop
    if ($null -ne $json.url) {
      Write-Host ("Generated URL: {0}" -f $json.url)
    }
  } catch { }  # non-JSON is fine for this smoke

} catch {
  # PowerShell 7 throws HttpResponseException with HttpResponseMessage
  $status = $null
  $errBody = $null
  $ex = $_.Exception

  if ($ex.PSObject.Properties.Name -contains 'Response' -and $ex.Response) {
    try { $status = [int]$ex.Response.StatusCode } catch { }
    try { $errBody = $ex.Response.Content.ReadAsStringAsync().GetAwaiter().GetResult() } catch { }
  }

  if ($status) {
    if ($errBody) { Write-Host $errBody }
    throw "Presign HTTP $status"
  } else {
    throw  # unknown failure; bubble up
  }
}
