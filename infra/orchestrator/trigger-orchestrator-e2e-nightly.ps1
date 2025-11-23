param(
    [string]$WorkflowFile = 'orchestrator-e2e-nightly.yml',
    [string]$Branch       = 'main',
    [int]   $MaxPolls     = 60,
    [int]   $SleepSeconds = 10
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Discover repo root (git-first, fallback: current)
$Repo = $null
try {
    $Repo = (git rev-parse --show-toplevel 2>$null).Trim()
} catch {
    $Repo = $null
}
if (-not $Repo) {
    $Repo = (Get-Location).Path
}
Set-Location $Repo

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "GitHub CLI 'gh' not found on PATH. Install/configure gh before running this." -ForegroundColor Red
    $global:LASTEXITCODE = 1
    return
}

Write-Host ("Triggering GitHub Actions workflow '{0}' on branch '{1}'..." -f $WorkflowFile, $Branch) -ForegroundColor Cyan

# Kick off a new run
gh workflow run $WorkflowFile --ref $Branch | Out-Null

Write-Host "Workflow dispatched. Polling latest run for status..." -ForegroundColor Cyan

$run        = $null
$runId      = $null
$status     = $null
$conclusion = $null
$runUrl     = $null
$poll       = 0

while ($poll -lt $MaxPolls) {
    $poll++

    # Ask gh for the latest run JSON (note: 'url', not 'htmlUrl')
    $runJson = gh run list `
        --workflow $WorkflowFile `
        --branch   $Branch `
        --limit    1 `
        --json     databaseId,status,conclusion,displayTitle,url,createdAt,updatedAt 2>$null

    if (-not $runJson -or -not $runJson.Trim()) {
        Write-Host ("Poll #{0}: no runs found yet. Sleeping {1} sec..." -f $poll, $SleepSeconds) -ForegroundColor Yellow
        Start-Sleep -Seconds $SleepSeconds
        continue
    }

    try {
        $parsed = $runJson | ConvertFrom-Json
        if ($parsed -is [System.Array]) {
            $run = $parsed | Select-Object -First 1
        } else {
            $run = $parsed
        }
    } catch {
        Write-Host ("Poll #{0}: failed to parse gh run list JSON: {1}" -f $poll, $_.Exception.Message) -ForegroundColor Yellow
        Start-Sleep -Seconds $SleepSeconds
        continue
    }

    if (-not $run) {
        Write-Host ("Poll #{0}: gh returned no runs. Sleeping {1} sec..." -f $poll, $SleepSeconds) -ForegroundColor Yellow
        Start-Sleep -Seconds $SleepSeconds
        continue
    }

    $runId      = $run.databaseId
    $status     = $run.status
    $conclusion = $run.conclusion
    $runUrl     = $run.url

    Write-Host ("Poll #{0}: status={1}, conclusion={2}" -f $poll, $status, ($conclusion ?? '<null>')) -ForegroundColor DarkCyan
    Write-Host ("  URL: {0}" -f $runUrl) -ForegroundColor DarkGray

    if ($status -eq 'completed') {
        break
    }

    Start-Sleep -Seconds $SleepSeconds
}

if (-not $runId -or -not $run) {
    Write-Host ("Failed to locate a workflow run for '{0}' on branch '{1}'." -f $WorkflowFile, $Branch) -ForegroundColor Red
    $global:LASTEXITCODE = 1
    return
}

if ($status -ne 'completed') {
    Write-Host ("Workflow run {0} did not reach 'completed' within timeout (status={1})." -f $runId, $status) -ForegroundColor Red
    $global:LASTEXITCODE = 1
    return
}

if ($conclusion -ne 'success') {
    Write-Host ("{0} FAILED (conclusion={1}) — inspect run: {2}" -f $WorkflowFile, $conclusion, $runUrl) -ForegroundColor Red
    $global:LASTEXITCODE = 1
    return
}

Write-Host ("{0} PASSED (runId={1}) — {2}" -f $WorkflowFile, $runId, $runUrl) -ForegroundColor Green
$global:LASTEXITCODE = 0
return
