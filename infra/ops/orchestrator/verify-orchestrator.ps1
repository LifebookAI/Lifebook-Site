param(
    [int]   $MinutesBack = 60,
    [string]$Profile     = 'lifebook-sso',
    [string]$Region      = 'us-east-1'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host "=== Orchestrator overall verification ===" -ForegroundColor Cyan
Write-Host "  MinutesBack : $MinutesBack"
Write-Host "  Profile     : $Profile"
Write-Host "  Region      : $Region"
Write-Host ""

# Locate the queue verifier relative to this script
$scriptDir   = Split-Path -Parent $PSCommandPath
$queueScript = Join-Path $scriptDir 'verify-orchestrator-queue.ps1'

if (-not (Test-Path $queueScript)) {
    throw "Missing queue verifier: $queueScript"
}

Write-Host "[1/1] Verifying orchestrator SQS principals..." -ForegroundColor Green
& $queueScript -MinutesBack $MinutesBack -Profile $Profile -Region $Region
$queueExit = $LASTEXITCODE
Write-Host "verify-orchestrator-queue.ps1 exit code: $queueExit" -ForegroundColor Cyan

if ($queueExit -ne 0) {
    Write-Error "Orchestrator queue principal verifier FAILED with exit code $queueExit"
    $global:LASTEXITCODE = $queueExit
    exit $queueExit
}

Write-Host ""
Write-Host "All orchestrator verifications succeeded." -ForegroundColor Green
$global:LASTEXITCODE = 0
