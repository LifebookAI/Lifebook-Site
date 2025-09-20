# ====== CONFIG: FILL THESE ======
$Base        = "https://api.uselifebook.ai/prod"   # or your execute-api .../prod
$ApiKey      = "08ce4f998426a42ad715ae5e193f4d2d6664d058dbe7560359309d9efe5869a4"                 # 64-char key you created
$HmacSecret  = "B522BC906F8CFA914B07EF0027E323E0739E239D60DAD8C7D2DD3B424CB44601"        # 64-byte HEX key (no '0x', no spaces)

# ====== Build request body ======
$rand = Get-Random
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$key = "sources/smoke-$stamp-$rand.txt"

$bodyObj = @{
  key                = $key
  contentType        = "text/plain"
  contentDisposition = "inline"
} | ConvertTo-Json -Compress

# ====== HMAC headers ======
# signature over "$ts.$body" with HMAC-SHA256 using HEX-decoded $HmacSecret
$ts = [int](Get-Date -UFormat %s)
$toSign = "$ts.$bodyObj"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($toSign)
$keyBytes = [System.Convert]::FromHexString($HmacSecret)
$hmac = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)
$sigBytes = $hmac.ComputeHash($bytes)
$signature = ([System.BitConverter]::ToString($sigBytes) -replace '-', '').ToLower()

$headers = @{
  "x-api-key"   = $ApiKey
  "x-timestamp" = $ts
  "x-signature" = $signature
  "content-type"= "application/json"
}

# ====== 1) Request a presign ======
$presign = Invoke-RestMethod -Method POST -Uri "$Base/presign" -Headers $headers -Body $bodyObj
if (-not $presign.url) { throw "No 'url' in presign response. Raw: $($presign | ConvertTo-Json -Depth 5)" }

$putUrl = $presign.url

# Some builds return required PUT headers; honor them if present
$uploadHeaders = @{}
if ($presign.headers) {
  $presign.headers.PSObject.Properties | ForEach-Object { $uploadHeaders[$_.Name] = $_.Value }
}
if (-not $uploadHeaders["Content-Type"]) { $uploadHeaders["Content-Type"] = "text/plain" }
if (-not $uploadHeaders["x-amz-server-side-encryption"]) { $uploadHeaders["x-amz-server-side-encryption"] = "AES256" }
if (-not $uploadHeaders["Content-Disposition"]) { $uploadHeaders["Content-Disposition"] = "inline" }

# ====== 2) Upload via S3 presigned PUT ======
$data = [System.Text.Encoding]::UTF8.GetBytes("hello smoke $(Get-Date -Format s)")
Invoke-RestMethod -Method PUT -Uri $putUrl -Body $data -Headers $uploadHeaders | Out-Null

# ====== 3) Verify via CloudFront ======
# Derive the key from the presigned URL path
$uri = [System.Uri]$putUrl
$keyFromUrl = [System.Net.WebUtility]::UrlDecode($uri.AbsolutePath).TrimStart('/')
$cfUrl = "https://files.uselifebook.ai/$keyFromUrl"

$response = Invoke-WebRequest -Method GET -Uri $cfUrl
"VERIFY URL: $cfUrl"
"VERIFY STATUS: $($response.StatusCode)"
"VERIFY BODY (first 120 chars): " + ($response.Content.Substring(0, [Math]::Min(120, $response.Content.Length)))
