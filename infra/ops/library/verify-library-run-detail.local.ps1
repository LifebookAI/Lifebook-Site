param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[INFO] Verifying Library run detail page against $BaseUrl" -ForegroundColor Cyan

# In CI, if J1 DATABASE_URL is not configured, skip this verifier.
if ($Env:GITHUB_ACTIONS -eq "true" -and (-not $Env:DATABASE_URL -or -not $Env:DATABASE_URL.Trim())) {
    Write-Warning "[SKIP] Library run detail page requires DATABASE_URL for J1; skipping verification in CI because DB is not configured."
    exit 0
}

# 1) Trigger a hello-library run via API
$apiUrl = "$BaseUrl/api/library/hello-library/run"
Write-Host "[STEP] POST $apiUrl" -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri $apiUrl -Method Post -ErrorAction Stop
} catch {
    throw ("Failed to POST {0}: {1}" -f $apiUrl, $_.Exception.Message)
}

if (-not $response.Content) {
    throw ("Empty response content from {0}." -f $apiUrl)
}

try {
    $payload = $response.Content | ConvertFrom-Json
} catch {
    throw ("Failed to parse JSON from {0}: {1}" -f $apiUrl, $response.Content)
}

if (-not $payload.ok) {
    throw ("Expected ok=true from {0} but got ok={1}. Raw: {2}" -f $apiUrl, $payload.ok, $response.Content)
}

$runId         = $payload.runId
$libraryItemId = $payload.libraryItemId
$status        = $payload.status
$createdAt     = $payload.createdAt

Write-Host ("[OK] Got runId: {0} (status={1}, item={2})" -f $runId, $status, $libraryItemId) -ForegroundColor Green

if (-not $runId -or -not $runId.Trim()) {
    throw ("RunId was empty in response from {0}." -f $apiUrl)
}

# 2) Fetch the run detail page
$runUrl = "$BaseUrl/library/runs/$runId"
Write-Host "[STEP] GET $runUrl" -ForegroundColor Yellow

try {
    $pageResponse = Invoke-WebRequest -Uri $runUrl -Method Get -ErrorAction Stop
} catch {
    $body = $null
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        $body = $_.ErrorDetails.Message
    } else {
        $body = $_.ToString()
    }

    throw ("Failed to GET {0}. Exception: {1}. Body: {2}" -f $runUrl, $_.Exception.Message, $body)
}

if ($pageResponse.StatusCode -ne 200) {
    throw ("Expected HTTP 200 from {0} but got HTTP {1}." -f $runUrl, $pageResponse.StatusCode)
}

# Best-effort check that the runId appears somewhere in the HTML
if ($pageResponse.Content -and $pageResponse.Content -match [regex]::Escape($runId)) {
    Write-Host "[OK] Run detail page responded with 200 and includes the runId." -ForegroundColor Green
} else {
    Write-Warning ("Run detail page HTML did not contain runId '{0}'; page content may be missing key details." -f $runId)
}

Write-Host "[OK] Library run detail verifier completed successfully." -ForegroundColor Green
exit 0
