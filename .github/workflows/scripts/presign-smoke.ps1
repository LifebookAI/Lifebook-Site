# presign-smoke.ps1
# CI smoke: presign -> PUT to S3 -> verify via CloudFront

$ErrorActionPreference = "Stop"

# === Inputs from workflow env ===
$API_BASE = "$env:API_BASE".Trim()     # e.g. https://api.uselifebook.ai/presign
$API_KEY  = "$env:API_KEY".Trim()      # API Gateway key
$SECRET   = "$env:SECRET".Trim()       # HMAC secret (hex or raw)

Write-Host "API_BASE length: $($API_BASE.Length)"
Write-Host "API_KEY  length: $($API_KEY.Length)"
Write-Host "SECRET   length: $($SECRET.Length)"

if ([string]::IsNullOrWhiteSpace($API_BASE) -or
    [string]::IsNullOrWhiteSpace($API_KEY)  -or
    [string]::IsNullOrWhiteSpace($SECRET)) {
    Write-Error "Missing one or more required env vars: API_BASE, API_KEY, SECRET"
}

# === Helpers ===
function HexToBytes([string]$hex) {
    if ($hex -match '^[0-9a-fA-F]+$' -and ($hex.Length % 2 -eq 0)) {
        $out = New-Object byte[] ($hex.Length/2)
        for ($i = 0; $i -lt $hex.Length; $i += 2) {
            $out[$i/2] = [Convert]::ToByte($hex.Substring($i,2),16)
        }
        return $out
    }
    # Not hex -> treat as UTF8 text secret
    return [Text.Encoding]::UTF8.GetBytes($hex)
}

function HmacHex([byte[]]$key, [string]$msg) {
    $h = [System.Security.Cryptography.HMACSHA256]::new($key)
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
        $hash  = $h.ComputeHash($bytes)
        return -join ($hash | ForEach-Object { $_.ToString('x2') })
    } finally {
        $h.Dispose()
    }
}

# Build canonical body (single-line JSON, no extra whitespace)
$keyPath = "sources/hello.txt"
$bodyObj = @{
    key               = $keyPath
    contentType       = "text/plain"
    contentDisposition= 'attachment; filename="hello.txt"'
    sse               = "AES256"
    checksum          = "crc32"
}
$body = ($bodyObj | ConvertTo-Json -Compress)

# Signature over "ts.body" using HMAC-SHA256 hex
$ts       = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
$payload  = "$ts.$body"
$secretBs = HexToBytes $SECRET
$sig      = HmacHex $secretBs $payload

# --- Presign call (HttpClient; read content BEFORE disposing) ---
$client = [System.Net.Http.HttpClient]::new()

try {
    $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, $API_BASE)
    $req.Content = [System.Net.Http.StringContent]::new($body, [Text.Encoding]::UTF8, "application/json")
    $req.Headers.Add("x-api-key",   $API_KEY)
    $req.Headers.Add("x-timestamp", $ts)
    $req.Headers.Add("x-signature", $sig)

    $resp      = $client.SendAsync($req).GetAwaiter().GetResult()
    $httpCode  = [int]$resp.StatusCode
    $respText  = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    if ($httpCode -lt 200 -or $httpCode -ge 300) {
        Write-Host "Presign failed:"
        Write-Host $respText
        throw "Presign HTTP $httpCode"
    }

    # Parse JSON { url, publicUrl, ... }
    $presign   = $respText | ConvertFrom-Json
    $putUrl    = "$($presign.url)"
    $publicUrl = "$($presign.publicUrl)"

    if (-not $putUrl)    { throw "Presign response missing url" }
    if (-not $publicUrl) { throw "Presign response missing publicUrl" }

    Write-Host "Got presign URL (length $($putUrl.Length))"
    Write-Host "Public URL: $publicUrl"

    # --- PUT the object to S3 (headers must match the ones used in presign) ---
    $putReq = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Put, $putUrl)

    # File content
    $bytes = [Text.Encoding]::ASCII.GetBytes("hello Lifebook $(Get-Date -Format s)")
    $putReq.Content = [System.Net.Http.ByteArrayContent]::new($bytes)
    $putReq.Content.Headers.ContentType =
        [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("text/plain")
    $putReq.Content.Headers.Add("content-disposition", 'attachment; filename="hello.txt"')

    # Must include SSE header, as it was part of the presign
    $putReq.Headers.Add("x-amz-server-side-encryption", "AES256")

    $putResp    = $client.SendAsync($putReq).GetAwaiter().GetResult()
    $putCode    = [int]$putResp.StatusCode
    if ($putCode -lt 200 -or $putCode -ge 300) {
        $putText = $putResp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        Write-Host "PUT failed ($putCode):"
        Write-Host $putText
        throw "PUT HTTP $putCode"
    }

    # --- Verify via CloudFront (cache-bust with timestamp) ---
    $checkUrl = "$publicUrl?ts=$(Get-Date -UFormat %s)"
    $chkResp  = $client.GetAsync($checkUrl).GetAwaiter().GetResult()
    $chkCode  = [int]$chkResp.StatusCode
    $chkBody  = $chkResp.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    if ($chkCode -lt 200 -or $chkCode -ge 300) {
        Write-Host "Verify failed ($chkCode)"
        Write-Host $chkBody
        throw "Verify HTTP $chkCode"
    }

    Write-Host "SUCCESS ✅  ($chkCode)  $publicUrl"
}
finally {
    if ($resp)     { $resp.Dispose() }
    if ($putResp)  { $putResp.Dispose() }
    if ($client)   { $client.Dispose() }
}
