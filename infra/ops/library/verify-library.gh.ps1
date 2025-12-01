param(
    [string]$Repo = 'LifebookAI/Lifebook-Site',
    [string]$WorkflowFile = 'library-e2e.yml',
    [int]$TimeoutMinutes = 20
)

# NORMAL (PS7) — Trigger & watch the library-e2e GitHub Actions workflow for the current commit
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail {
    param(
        [string]$Message
    )
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    exit 1
}

Write-Host "Verifying GitHub Actions workflow '$WorkflowFile' in repo '$Repo'..." -ForegroundColor Cyan

# 1) Ensure gh is available
try {
    gh --version | Out-Null
} catch {
    Fail "GitHub CLI 'gh' is not installed or not on PATH. Install gh and authenticate before running this verifier."
}

# 2) Ensure we're on a branch and capture HEAD SHA
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $branch) {
    Fail "Could not determine current git branch."
}

$headSha = (git rev-parse HEAD).Trim()
if (-not $headSha) {
    Fail "Could not determine current HEAD SHA."
}

Write-Host "Current branch: $branch" -ForegroundColor Cyan
Write-Host "HEAD SHA       : $headSha" -ForegroundColor Cyan

# 3) Trigger the workflow on this branch
Write-Host "Triggering workflow '$WorkflowFile' on branch '$branch'..." -ForegroundColor Yellow
gh workflow run $WorkflowFile --repo $Repo --ref $branch | Write-Host

# 4) Poll for the run associated with this HEAD SHA
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
$runId = $null

Write-Host "Waiting for workflow run to appear (timeout: $TimeoutMinutes minutes)..." -ForegroundColor Yellow

while ($true) {
    if (Get-Date > $deadline) {
        Fail "Timed out waiting for a workflow run for $headSha."
    }

    $json = gh run list `
        --repo $Repo `
        --workflow $WorkflowFile `
        --branch $branch `
        --limit 5 `
        --json databaseId,headSha,status,conclusion,displayTitle,createdAt 2>$null

    if (-not $json) {
        Start-Sleep -Seconds 10
        continue
    }

    $runs = $json | ConvertFrom-Json
    if (-not $runs) {
        Start-Sleep -Seconds 10
        continue
    }

    # Pick the most recent run that matches the current HEAD SHA
    $matching = $runs | Where-Object { $_.headSha -eq $headSha } | Select-Object -First 1
    if (-not $matching) {
        Start-Sleep -Seconds 10
        continue
    }

    $runId      = $matching.databaseId
    $status     = $matching.status
    $conclusion = $matching.conclusion

    Write-Host ("Run {0} status: {1} (conclusion: {2})" -f $runId, $status, $conclusion) -ForegroundColor DarkCyan

    if ($status -ne 'completed') {
        Start-Sleep -Seconds 10
        continue
    }

    if ($conclusion -ne 'success') {
        Fail ("Workflow run {0} completed with conclusion '{1}'." -f $runId, $conclusion)
    }

    break
}

Write-Host ""
Write-Host ("[OK] Library GitHub workflow '{0}' succeeded for commit {1}." -f $WorkflowFile, $headSha) -ForegroundColor Green
