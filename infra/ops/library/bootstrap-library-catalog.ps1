# NORMAL (PS7) — Phase 4 / Step 19B: Bootstrap a versioned Library catalog and validate it
# - Creates data/library/catalog.v1.json with a minimal but real schema + seed items:
#     * workflow.hello-library (Hello Library workflow template)
#     * track.aws-foundations (AWS Foundations Study Track)
#     * track.devops-essentials (DevOps Essentials Study Track)
# - Safe to re-run; will skip overwriting unless -Force is provided
# - Validation uses PowerShell's JSON parser and prints a summary table

[CmdletBinding()]
param(
    # Repo root; default matches your current setup but can be overridden
    [string]$RepoRoot = 'C:\Users\zacha\src\Lifebook-Site',

    # If set, run validation only (do not create/overwrite the catalog)
    [switch]$VerifyOnly,

    # If set, allow overwriting an existing catalog file
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Resolve-RepoRoot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "RepoRoot '$Path' does not exist. Fix -RepoRoot or create the directory."
    }

    Set-Location -LiteralPath $Path

    if (-not (Test-Path -LiteralPath '.git')) {
        throw "RepoRoot '$Path' does not appear to be a git repo (missing .git)."
    }

    Write-Host "[OK] Repo root: $Path" -ForegroundColor Green
}

function New-LibraryCatalog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CatalogDir,
        [Parameter(Mandatory = $true)]
        [string]$CatalogPath,
        [switch]$Force
    )

    if ((Test-Path -LiteralPath $CatalogPath) -and (-not $Force)) {
        Write-Host "[SKIP] Library catalog already exists at $CatalogPath (use -Force to overwrite)." -ForegroundColor Yellow
        return
    }

    if (-not (Test-Path -LiteralPath $CatalogDir)) {
        New-Item -ItemType Directory -Path $CatalogDir -Force | Out-Null
        Write-Host "[OK] Created directory $CatalogDir" -ForegroundColor Green
    }

    # Minimal, versioned catalog seed aligned with v3.0 “Developer Workflows & Learning OS”
    # These IDs/slugs are intended to be stable contracts used by:
    # - /api/library
    # - Study Tracks (19C)
    # - Analytics & artifacts (FD-1, FD-9)
    $catalog = @{
        specVersion = "library.v1"
        generatedAt = (Get-Date).ToString("o")
        items       = @(
            @{
                id          = "workflow.hello-library"
                kind        = "workflow-template"   # template users can run to exercise the system
                slug        = "hello-library"
                title       = "Hello Library Workflow"
                description = "Minimal workflow that runs once, writes a small artifact, and saves it into your Library so you can see WEA/AW in action."
                status      = "draft"              # draft | beta | stable
                version     = "0.1.0"
                tags        = @("workflow", "template", "onboarding", "developer-os")
            },
            @{
                id          = "track.aws-foundations"
                kind        = "study-track"
                slug        = "aws-foundations"
                title       = "AWS Foundations (SAA Week 1–2)"
                description = "Guided AWS SAA Foundations track: IAM, S3, networking basics, and a daily workflow/capture loop that produces real artifacts."
                status      = "draft"              # draft | beta | stable
                version     = "0.1.0"
                tags        = @("study-track", "aws", "saa-c03", "foundations")
            },
            @{
                id          = "track.devops-essentials"
                kind        = "study-track"
                slug        = "devops-essentials"
                title       = "DevOps Essentials (Pipelines & Observability)"
                description = "DevOps Essentials Study Track: CI/CD basics, environment separation, and observability workflows that ship tangible artifacts."
                status      = "draft"              # draft | beta | stable
                version     = "0.1.0"
                tags        = @("study-track", "devops", "pipelines", "observability")
            }
        )
    }

    $json = $catalog | ConvertTo-Json -Depth 6

    # UTF-8 without BOM to keep diffs clean and Node/Next.js-friendly
    $json | Set-Content -LiteralPath $CatalogPath -Encoding utf8NoBOM

    Write-Host "[OK] Wrote Library catalog to $CatalogPath" -ForegroundColor Green
}

function Test-LibraryCatalog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CatalogPath
    )

    if (-not (Test-Path -LiteralPath $CatalogPath)) {
        throw "Library catalog file not found at '$CatalogPath'. Run without -VerifyOnly first."
    }

    $raw = Get-Content -LiteralPath $CatalogPath -Raw -Encoding UTF8

    try {
        $obj = $raw | ConvertFrom-Json
    }
    catch {
        throw "Library catalog JSON is invalid: $($_.Exception.Message)"
    }

    if (-not $obj.specVersion) {
        throw "Library catalog is missing 'specVersion'."
    }

    if (-not $obj.items -or $obj.items.Count -lt 1) {
        throw "Library catalog 'items' is missing or empty."
    }

    Write-Host ("[OK] Library catalog is valid. specVersion={0}, items={1}" -f $obj.specVersion, $obj.items.Count) -ForegroundColor Green

    # Print a small summary table of items for quick visual verification
    $summary = $obj.items | Select-Object `
        @{ Name = 'Id';     Expression = { $_.id } },
        @{ Name = 'Kind';   Expression = { $_.kind } },
        @{ Name = 'Title';  Expression = { $_.title } },
        @{ Name = 'Status'; Expression = { $_.status } }

    $summary | Format-Table -AutoSize
}

# ---- Main execution ----

Resolve-RepoRoot -Path $RepoRoot

$catalogDir  = Join-Path -Path $RepoRoot -ChildPath 'data/library'
$catalogPath = Join-Path -Path $catalogDir -ChildPath 'catalog.v1.json'

if (-not $VerifyOnly) {
    New-LibraryCatalog -CatalogDir $catalogDir -CatalogPath $catalogPath -Force:$Force
}

Test-LibraryCatalog -CatalogPath $catalogPath
