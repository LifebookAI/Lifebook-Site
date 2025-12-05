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

Write-Host "[STEP] gh workflow run $WorkflowFile --ref $Ref --repo $Repo" -ForegroundColor Yellow
gh workflow run $WorkflowFile --ref $Ref --repo $Repo
if ($LASTEXITCODE -ne 0) {
    throw "gh workflow run failed with exit code $LASTEXITCODE."
}

Write-Host "[INFO] Waiting for a run of '$WorkflowFile' on branch '$Ref'..." -ForegroundColor Cyan

$run = $null

for ($i = 1; $i -le 60; $i++) {
    $json = gh run list `
        --workflow $WorkflowFile `
        --repo $Repo `
        --limit 10 `
        --json databaseId,workflowName,headBranch,status,conclusion,createdAt,url 2>$null

    if ($LASTEXITCODE -eq 0 -and $json -and $json.Trim()) {
        try {
            $runs = $json | ConvertFrom-Json
            if ($runs) {
                # Newest run for this workflow on this branch
                $run = $runs |
                    Where-Object { $_.headBranch -eq $Ref } |
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
Write-Host "[INFO] Watching run $runId ($($run.workflowName)) at $($run.url)" -ForegroundColor Cyan

while ($true) {
    $json = gh run view $runId --repo $Repo --json status,conclusion,updatedAt,url 2>$null
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
    Write-Error "Library Phase 4 CI workflow FAILED with conclusion '$conclusion'. See $($state.url)"
    exit 1
}

Write-Host "[OK] Library Phase 4 CI workflow SUCCEEDED. See $($state.url)" -ForegroundColor Green
exit 0
