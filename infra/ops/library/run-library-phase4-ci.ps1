param(
    [string]$Ref = "main"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[INFO] Triggering Library Phase 4 CI workflow on ref '$Ref'..." -ForegroundColor Cyan

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI 'gh' not found on PATH. Install from https://cli.github.com/ and authenticate with 'gh auth login'."
}

$Repo = "LifebookAI/Lifebook-Site"

Write-Host "[STEP] gh workflow run library-phase4.yml --ref $Ref --repo $Repo" -ForegroundColor Yellow
gh workflow run library-phase4.yml --ref $Ref --repo $Repo
if ($LASTEXITCODE -ne 0) {
    throw "gh workflow run failed with exit code $LASTEXITCODE."
}

Write-Host "[INFO] Waiting for latest library-phase4.yml run to appear..." -ForegroundColor Cyan

$run = $null
for ($i = 1; $i -le 30; $i++) {
    $json = gh run list --workflow "library-phase4.yml" --repo $Repo --limit 1 --json databaseId,status,conclusion,displayTitle,createdAt,updatedAt,htmlUrl 2>$null
    if ($LASTEXITCODE -eq 0 -and $json -and $json.Trim()) {
        $runs = $json | ConvertFrom-Json
        if ($runs) {
            $run = $runs | Select-Object -First 1
            break
        }
    }
    Write-Host "[INFO] No run found yet (attempt $i/30); sleeping 4s..." -ForegroundColor DarkYellow
    Start-Sleep -Seconds 4
}

if (-not $run) {
    throw "Timed out waiting for a workflow run to appear for library-phase4.yml."
}

$runId = $run.databaseId
Write-Host "[INFO] Watching run $runId ($($run.displayTitle)) at $($run.htmlUrl)" -ForegroundColor Cyan

while ($true) {
    $json = gh run view $runId --repo $Repo --json status,conclusion,updatedAt,htmlUrl 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $json) {
        Write-Warning "gh run view failed (exit $LASTEXITCODE); retrying in 5s..."
        Start-Sleep -Seconds 5
        continue
    }

    $state      = $json | ConvertFrom-Json
    $status     = $state.status
    $conclusion = $state.conclusion

    Write-Host "[INFO] Status=$status, Conclusion=$conclusion, UpdatedAt=$($state.updatedAt)" -ForegroundColor Gray

    if ($status -eq "completed") {
        break
    }

    Start-Sleep -Seconds 5
}

if ($conclusion -ne "success") {
    Write-Error "Library Phase 4 CI workflow FAILED with conclusion '$conclusion'. See $($state.htmlUrl)"
    exit 1
}

Write-Host "[OK] Library Phase 4 CI workflow SUCCEEDED. See $($state.htmlUrl)" -ForegroundColor Green
exit 0
