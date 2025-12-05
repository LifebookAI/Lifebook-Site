param(
    [string]$Ref = "main"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "[INFO] Triggering Library Phase 4 CI workflow on ref '$Ref'..." -ForegroundColor Cyan

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI 'gh' not found on PATH. Install from https://cli.github.com/ and authenticate with 'gh auth login'."
}

$Repo         = "LifebookAI/Lifebook-Site"
$WorkflowFile = "library-phase4.yml"

# Remember when we triggered, so we can ignore older runs
$startTime = Get-Date

Write-Host "[STEP] gh workflow run $WorkflowFile --ref $Ref --repo $Repo" -ForegroundColor Yellow
gh workflow run $WorkflowFile --ref $Ref --repo $Repo
if ($LASTEXITCODE -ne 0) {
    throw "gh workflow run failed with exit code $LASTEXITCODE."
}

Write-Host "[INFO] Waiting for latest '$WorkflowFile' run (branch '$Ref') created after $startTime ..." -ForegroundColor Cyan

$run = $null

for ($i = 1; $i -le 60; $i++) {
    # Always include disabled workflows just in case
    $json = gh run list `
        --workflow $WorkflowFile `
        --branch $Ref `
        --repo $Repo `
        --all `
        --limit 20 `
        --json databaseId,status,conclusion,displayTitle,createdAt,updatedAt,htmlUrl,headBranch 2>$null

    if ($LASTEXITCODE -eq 0 -and $json -and $json.Trim()) {
        try {
            $runs = $json | ConvertFrom-Json
            if ($runs) {
                # Pick the newest run on this branch created after we triggered (with a small 30s cushion)
                $cutoff = $startTime.AddSeconds(-30)
                $run = $runs |
                    Where-Object {
                        $_.headBranch -eq $Ref -and
                        ([datetime]$_.createdAt) -ge $cutoff
                    } |
                    Sort-Object { [datetime]$_.createdAt } -Descending |
                    Select-Object -First 1
            }
        } catch {
            Write-Warning ("Failed to parse gh run list JSON on attempt {0}: {1}" -f $i, $_)
        }
    }

    if ($run) {
        break
    }

    Write-Host "[INFO] No matching run found yet (attempt $i/60); sleeping 5s..." -ForegroundColor DarkYellow
    Start-Sleep -Seconds 5
}

if (-not $run) {
    throw "Timed out waiting for a workflow run to appear for '$WorkflowFile' on branch '$Ref'."
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

    try {
        $state = $json | ConvertFrom-Json
    } catch {
        Write-Warning ("Failed to parse gh run view JSON; retrying in 5s... {0}" -f $_)
        Start-Sleep -Seconds 5
        continue
    }

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
