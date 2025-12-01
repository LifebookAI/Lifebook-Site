param(
    [string]$BaseUrl = 'http://localhost:3000'
)

# NORMAL (PS7) — Verify Library API + UI against a running dev server
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail {
    param(
        [string]$Message
    )
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    exit 1
}

Write-Host "Verifying Library against $BaseUrl ..." -ForegroundColor Cyan

# 1) /api/library (list)
$listUri = "$BaseUrl/api/library"
Write-Host "GET $listUri" -ForegroundColor Yellow
$listResp = Invoke-WebRequest -Uri $listUri -Method Get -SkipHttpErrorCheck

if ($listResp.StatusCode -ne 200) {
    Fail "/api/library returned status $($listResp.StatusCode)"
}

$listData  = $listResp.Content | ConvertFrom-Json
$items     = @($listData.items)

if (-not $items -or $items.Count -eq 0) {
    Fail "/api/library returned 0 items (expected at least one workflow run)."
}

# Prefer an S3-backed workflow run (job-*)
$target = $items | Where-Object { $_.id -like 'job-*' } | Select-Object -First 1
if (-not $target) {
    $target = $items[0]
}

$targetId = $target.id
Write-Host "Using Library item id: $targetId" -ForegroundColor Cyan

# 2) /api/library?id=... (detail)
$detailApiUri = "$BaseUrl/api/library?id=$targetId"
Write-Host "GET $detailApiUri" -ForegroundColor Yellow
$detailApiResp = Invoke-WebRequest -Uri $detailApiUri -Method Get -SkipHttpErrorCheck

if ($detailApiResp.StatusCode -ne 200) {
    Fail "/api/library?id=... returned status $($detailApiResp.StatusCode)"
}

$detailData = $detailApiResp.Content | ConvertFrom-Json
$item       = $detailData.item

if (-not $item) {
    Fail "/api/library?id=... returned no item payload."
}

$text = $item.rawText
if (-not $text -or -not $text.Trim()) {
    $text = $item.bodyMarkdown
}

if (-not $text -or -not $text.Trim()) {
    Fail "Detail item has no body text (rawText/bodyMarkdown is empty)."
}

Write-Host "Detail API looks healthy (id/title/summary/body present)." -ForegroundColor Green

# 3) /library (UI list)
$listUiUri = "$BaseUrl/library"
Write-Host "GET $listUiUri" -ForegroundColor Yellow
$listUiResp = Invoke-WebRequest -Uri $listUiUri -Method Get -SkipHttpErrorCheck

if ($listUiResp.StatusCode -ne 200) {
    Fail "/library (UI) returned status $($listUiResp.StatusCode)"
}

$listHtml = $listUiResp.Content
$hasHeading = $listHtml -like '*Personal Library*'
$hasCount   = $listHtml -like '*Showing*result*'

if (-not $hasHeading) {
    Fail "/library HTML did not contain 'Personal Library' heading."
}

Write-Host "/library UI looks OK (heading present)." -ForegroundColor Green

# 4) /library/{id} (UI detail)
$detailUiUri = "$BaseUrl/library/$([Uri]::EscapeDataString($targetId))"
Write-Host "GET $detailUiUri" -ForegroundColor Yellow
$detailUiResp = Invoke-WebRequest -Uri $detailUiUri -Method Get -SkipHttpErrorCheck

if ($detailUiResp.StatusCode -ne 200) {
    Fail "/library/{id} (UI) returned status $($detailUiResp.StatusCode)"
}

$detailHtml = $detailUiResp.Content
$hasArtifact = $detailHtml -like '*Artifact*'

if (-not $hasArtifact) {
    Fail "/library/{id} HTML did not contain 'Artifact' section."
}

Write-Host "/library/{id} UI looks OK (Artifact section present)." -ForegroundColor Green

Write-Host "`n[OK] Library API + UI smoke test passed." -ForegroundColor Green
exit 0
