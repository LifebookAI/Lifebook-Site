[CmdletBinding()]
param(
    # Base URL for the dev server
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Test-Page {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [string]$Description,

        [string]$ExpectContains
    )

    $uri = "$BaseUrl$Path"
    Write-Host "[STEP] GET $uri ($Description)" -ForegroundColor Yellow

    try {
        $resp = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 10
    }
    catch {
        Write-Host "[FAIL] Request to $uri failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "       Is 'npm run dev' running on $BaseUrl ?" -ForegroundColor Red
        exit 1
    }

    if ($resp.StatusCode -ne 200) {
        Write-Host "[FAIL] $Path returned HTTP $($resp.StatusCode) (expected 200)." -ForegroundColor Red
        exit 1
    }

    if ($ExpectContains -and -not ($resp.Content -like "*$ExpectContains*")) {
        Write-Host "[FAIL] $Path did not contain expected text '$ExpectContains'." -ForegroundColor Red
        exit 1
    }

    Write-Host "[OK] $Path responded with 200 and looks good." -ForegroundColor Green
}

Write-Host "[INFO] Verifying Library UI against $BaseUrl" -ForegroundColor Cyan

# 0) Fetch Library catalog via API so we can discover slugs
$apiUri = "$BaseUrl/api/library"
Write-Host "[STEP] GET $apiUri (Library API)" -ForegroundColor Yellow

try {
    $apiResp = Invoke-WebRequest -Uri $apiUri -UseBasicParsing -TimeoutSec 10
}
catch {
    Write-Host "[FAIL] Request to $apiUri failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "       Is 'npm run dev' running on $BaseUrl ?" -ForegroundColor Red
    exit 1
}

if ($apiResp.StatusCode -ne 200) {
    Write-Host "[FAIL] /api/library returned HTTP $($apiResp.StatusCode) (expected 200)." -ForegroundColor Red
    exit 1
}

if (-not $apiResp.Content -or -not $apiResp.Content.Trim()) {
    Write-Host "[FAIL] /api/library returned an empty body." -ForegroundColor Red
    exit 1
}

try {
    $items = @($apiResp.Content | ConvertFrom-Json)
}
catch {
    Write-Host "[FAIL] Failed to parse JSON from /api/library: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$expectedIds = @(
    "workflow.hello-library",
    "track.aws-foundations",
    "track.devops-essentials"
)

$seedItems = @()

foreach ($id in $expectedIds) {
    $item = $items | Where-Object { $_.id -eq $id }

    if (-not $item) {
        Write-Host "[FAIL] Library API did not return an item with id '$id'." -ForegroundColor Red
        exit 1
    }

    if (-not $item.slug) {
        Write-Host "[FAIL] Library item '$id' is missing a 'slug' property." -ForegroundColor Red
        exit 1
    }

    Write-Host "[OK] Found item '$id' with slug '$($item.slug)'." -ForegroundColor Green
    $seedItems += $item
}

# 1) Library index — just look for a stable fragment of the heading
Test-Page -Path "/library" -Description "Library index" -ExpectContains "Saved workflows"

# 2) Detail pages for the three seed items, using their actual slugs + asserting CTA
foreach ($item in $seedItems) {
    $path = "/library/$($item.slug)"
    $desc = "$($item.title) detail"

    # Use the item.id as a stable substring (inside the <code> block)
    Test-Page -Path $path -Description $desc -ExpectContains $item.id

    # Assert CTA text based on the kind
    $cta =
        if ($item.kind -eq "workflow-template") {
            "Use this workflow"
        }
        elseif ($item.kind -eq "study-track") {
            "Start this track"
        }
        else {
            "Activate"
        }

    Test-Page -Path $path -Description "$desc CTA" -ExpectContains $cta
}

# 3) Search filter sanity checks
$searchChecks = @(
    @{ Path = "/library?q=aws";               Description = "Library search for 'aws'";               ExpectContains = "track.aws-foundations" },
    @{ Path = "/library?q=workflow";          Description = "Library search for 'workflow'";          ExpectContains = "workflow.hello-library" },
    @{ Path = "/library?q=devops";            Description = "Library search for 'devops'";            ExpectContains = "track.devops-essentials" },
    @{ Path = "/library?q=no-match-expected"; Description = "Library search with no matches";         ExpectContains = "No Library items match your search." }
)

foreach ($check in $searchChecks) {
    Test-Page -Path $check.Path -Description $check.Description -ExpectContains $check.ExpectContains
}

Write-Host "[OK] Library UI verifier completed successfully." -ForegroundColor Green
