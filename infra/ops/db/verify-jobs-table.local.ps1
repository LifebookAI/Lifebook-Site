param(
    [string] $DatabaseUrl
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Resolve repo root (three levels up from infra/ops/db)
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Set-Location $RepoRoot
Write-Host "[INFO] Repo root: $RepoRoot" -ForegroundColor Cyan

$migrationPath = Join-Path $RepoRoot 'db/migrations/20251108_library.sql'
if (-not (Test-Path -LiteralPath $migrationPath)) {
    throw "Migration file not found at $migrationPath"
}

# Find DATABASE_URL from .env.local if not passed in
if (-not $DatabaseUrl -or -not $DatabaseUrl.Trim()) {
    $envPath = Join-Path $RepoRoot '.env.local'
    if (-not (Test-Path -LiteralPath $envPath)) {
        if ($Env:GITHUB_ACTIONS -eq "true") {
    Write-Warning "[SKIP] No DatabaseUrl provided and .env.local not found at $envPath in CI; skipping jobs table verification."
    exit 0
}
throw "No DatabaseUrl provided and .env.local not found at $envPath"
    }

    $envLines = Get-Content -LiteralPath $envPath
    $databaseLine = $envLines | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if (-not $databaseLine) {
        throw "DATABASE_URL not found in .env.local"
    }

    $DatabaseUrl = $databaseLine -replace '^\s*DATABASE_URL\s*=\s*', ''
    $DatabaseUrl = $DatabaseUrl.Trim()

    if ($DatabaseUrl.StartsWith('"') -and $DatabaseUrl.EndsWith('"')) {
        $DatabaseUrl = $DatabaseUrl.Substring(1, $DatabaseUrl.Length - 2)
    } elseif ($DatabaseUrl.StartsWith("'") -and $DatabaseUrl.EndsWith("'")) {
        $DatabaseUrl = $DatabaseUrl.Substring(1, $DatabaseUrl.Length - 2)
    }
}

if (-not $DatabaseUrl -or -not $DatabaseUrl.Trim()) {
    throw "DATABASE_URL was empty after parsing."
}

Write-Host "[INFO] Using DATABASE_URL from config." -ForegroundColor Cyan

# Ensure node is available
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    throw "Node.js 'node' executable not found on PATH. Install Node.js and ensure 'node' is available, then re-run."
}

# Export DATABASE_URL for the Node script
$env:DATABASE_URL = $DatabaseUrl

$nodeScriptPath = Join-Path $PSScriptRoot 'verify-jobs-table.mjs'
if (-not (Test-Path -LiteralPath $nodeScriptPath)) {
    throw "Node verifier script not found at $nodeScriptPath"
}

Write-Host "[STEP] Running Node verifier verify-jobs-table.mjs..." -ForegroundColor Yellow
& $node.Source $nodeScriptPath
if ($LASTEXITCODE -ne 0) {
    throw "Node verifier failed with exit code $LASTEXITCODE."
}

Write-Host "[OK] jobs table verified via Node/pg client." -ForegroundColor Green

