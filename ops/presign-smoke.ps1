param([string]$VarsPath = (Join-Path (Get-Location) "ops/vars.json"))

$vars = Get-Content $VarsPath -Raw | ConvertFrom-Json
$apiBase = ($vars.presign.base ?? "").TrimEnd('/')
$path    = if ($vars.presign.path) { $vars.presign.path } else { "/presign" }
$api     = "$apiBase$path"
$cfBase  = ($vars.cloudfrontBase ?? "").TrimEnd('/')
$key     = "sources/heartbeat/smoke-$((Get-Date).ToString('yyyy-MM-ddTHH-mm-ssZ')).txt"

function Sign-Body([string]$ts,[string]$body,[string]$hex){
  $bytes = for ($i=0; $i -lt $hex.Length; $i+=2) { [Convert]::ToByte($hex.Substring($i,2),16) }
  $h = [System.Security.Cryptography.HMACSHA256]::new($bytes)
  ($h.ComputeHash([Text.Encoding]::UTF8.GetBytes("$ts.$body")) | ForEach-Object { $_.ToString("x2") }) -join ""
}

$bodyObj  = @{ key=$key; contentType="text/plain"; contentDisposition="inline" }
$bodyJson = ($bodyObj | ConvertTo-Json -Compress)
$ts       = [int][double]::Parse((Get-Date -UFormat %s))
$sig      = Sign-Body $ts $bodyJson $vars.presign.hmacHex
$headers  = @{ "x-api-key"=$vars.presign.apiKey; "x-timestamp"="$ts"; "x-signature"=$sig; "content-type"="application/json" }

$sw = [Diagnostics.Stopwatch]::StartNew()
$pres = Invoke-RestMethod -Method POST -Uri $api -Headers $headers -Body $bodyJson
$sw.Stop(); $t1=$sw.ElapsedMilliseconds; $sw.Restart()

# Convert returned headers (PSCustomObject) to hashtable for -Headers
$uh = @{}
if ($pres.headers) {
  foreach ($p in $pres.headers.PSObject.Properties) { $uh[$p.Name] = [string]$p.Value }
}
if (-not $uh.ContainsKey('Content-Type')) { $uh['Content-Type'] = 'text/plain' } # belt & suspenders

$uploadUrl = $pres.url ?? $pres.uploadUrl ?? $pres.put ?? $pres.signedUrl
if (-not $uploadUrl) { throw "presign missing upload URL" }

Invoke-WebRequest -Method PUT -Uri $uploadUrl -Headers $uh -Body ([Text.Encoding]::UTF8.GetBytes("smoke $(Get-Date -Format o)")) | Out-Null
$sw.Stop(); $t2=$sw.ElapsedMilliseconds; $sw.Restart()

$cfUrl = "$cfBase/$key"
# small retry for edge consistency (up to ~2s)
$ok = $false; $attempt=0
while(-not $ok -and $attempt -lt 5){
  try { Invoke-WebRequest -Method Head -Uri $cfUrl -ErrorAction Stop | Out-Null; $ok=$true }
  catch { Start-Sleep -Milliseconds (200 * [math]::Pow(2,$attempt)); $attempt++ }
}
if (-not $ok) { throw "CF HEAD failed after retries: $cfUrl" }
$sw.Stop(); $t3=$sw.ElapsedMilliseconds

"OK | presign=${t1}ms put=${t2}ms head=${t3}ms | $cfUrl"
