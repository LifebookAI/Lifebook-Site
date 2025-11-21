# NORMAL (PS7) — Orchestrator quality gate: status harness + idempotency tests + E2E smoke
# What this does:
# - Resolves repo root from this script's location
# - Ensures node, npx, pwsh, and a JS package manager (pnpm or npm) are available
# - Ensures tailwindcss + autoprefixer devDependencies are present for PostCSS
# - Runs, in order:
#     1) infra/orchestrator/test-job-status-transitions.mjs  (status/concurrency harness)
#     2) services/orchestrator/tests/idempotency.test.js     (via npx vitest)
#     3) infra/orchestrator/smoke-orchestrator-e2e.ps1       (full orchestrator E2E smoke)
# - Fails fast on any non-zero exit; prints a final ✅ only if everything passes

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host "[orchestrator-quality-gate] Starting..." -ForegroundColor Cyan

# 1) Resolve repo root from this script's location (infra/orchestrator → infra → repo)
$Repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path $Repo)) {
    throw "Unable to resolve repo root from script location (PSScriptRoot=$PSScriptRoot)."
}
Set-Location $Repo

$StatusHarnessPath = Join-Path $Repo 'infra/orchestrator/test-job-status-transitions.mjs'
$IdemTestPath      = Join-Path $Repo 'services/orchestrator/tests/idempotency.test.js'
$SmokeScript       = Join-Path $Repo 'infra/orchestrator/smoke-orchestrator-e2e.ps1'
$OrchServiceDir    = Join-Path $Repo 'services/orchestrator'
$PostCssPath       = Join-Path $Repo 'postcss.config.mjs'

foreach ($p in @($StatusHarnessPath, $IdemTestPath, $SmokeScript, $PostCssPath)) {
    if (-not (Test-Path $p)) {
        throw "Required orchestrator file not found: $p"
    }
}

if (-not (Test-Path $OrchServiceDir)) {
    throw "Orchestrator service dir not found: $OrchServiceDir"
}

# 2) Tool checks
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is not on PATH. Install Node (>=18) and re-run."
}
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    throw "npx is not on PATH. Ensure a standard Node install (with npx) and re-run."
}
if (-not (Get-Command pwsh -ErrorAction SilentlyContinue)) {
    throw "pwsh (PowerShell 7) not found. Install PowerShell 7 and re-run."
}

# 3) Ensure Tailwind + Autoprefixer deps for PostCSS
$autoprefixerDir = Join-Path $Repo 'node_modules/autoprefixer'

if (-not (Test-Path $autoprefixerDir)) {
    Write-Host "[deps] Installing tailwindcss + autoprefixer devDependencies at repo root..." -ForegroundColor Cyan

    $havePnpm = Get-Command pnpm -ErrorAction SilentlyContinue
    $haveNpm  = Get-Command npm  -ErrorAction SilentlyContinue

    if ($havePnpm) {
        pnpm add -D tailwindcss autoprefixer
        if ($LASTEXITCODE -ne 0) {
            throw "pnpm add -D tailwindcss autoprefixer failed with exit code $LASTEXITCODE"
        }
    }
    elseif ($haveNpm) {
        npm install --save-dev tailwindcss autoprefixer
        if ($LASTEXITCODE -ne 0) {
            throw "npm install --save-dev tailwindcss autoprefixer failed with exit code $LASTEXITCODE"
        }
    }
    else {
        throw "Neither pnpm nor npm is available; cannot install tailwindcss/autoprefixer required by PostCSS."
    }

    if (Test-Path $autoprefixerDir) {
        Write-Host "[deps] Confirmed autoprefixer present under node_modules." -ForegroundColor Green
    }
    else {
        Write-Host "[deps] Warning: autoprefixer directory not found under node_modules after install; Vitest may still fail." -ForegroundColor Yellow
    }
}
else {
    Write-Host "[deps] autoprefixer already present under node_modules; skipping install." -ForegroundColor DarkGray
}

# 4) Run status/concurrency harness
Write-Host "[1/3] Running orchestrator status/concurrency harness..." -ForegroundColor Cyan
node $StatusHarnessPath
$exit = $LASTEXITCODE
if ($exit -ne 0) {
    throw "Status/concurrency harness failed with exit code $exit"
}
Write-Host "[1/3] Status/concurrency harness passed." -ForegroundColor Green

# 5) Run idempotency tests via Vitest (through npx)
Write-Host "[2/3] Running orchestrator idempotency tests (npx vitest)..." -ForegroundColor Cyan
Push-Location $OrchServiceDir
npx vitest --run tests/idempotency.test.js
$idemExit = $LASTEXITCODE
Pop-Location
if ($idemExit -ne 0) {
    throw "Idempotency tests failed with exit code $idemExit"
}
Write-Host "[2/3] Idempotency tests passed." -ForegroundColor Green

# 6) Run orchestrator E2E smoke
Write-Host "[3/3] Running orchestrator E2E smoke..." -ForegroundColor Cyan
pwsh -NoProfile -ExecutionPolicy Bypass -File $SmokeScript
$smokeExit = $LASTEXITCODE
if ($smokeExit -ne 0) {
    throw "Orchestrator E2E smoke failed with exit code $smokeExit"
}
Write-Host "[3/3] Orchestrator E2E smoke passed." -ForegroundColor Green

Write-Host ""
Write-Host "[orchestrator-quality-gate] All orchestrator checks (status, idempotency, E2E) completed successfully ✅" -ForegroundColor Green
