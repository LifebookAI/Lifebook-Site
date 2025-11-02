param(
  [string]$Repo        = "LifebookAI/Lifebook-Site",
  [string]$BaseBranch  = "main",
  [string]$HeadBranch  = $(git rev-parse --abbrev-ref HEAD 2>$null),
  [string]$Title       = "chore: solo auto-merge",
  [string]$Body        = "Queue auto-merge with approvals=0 and a single required check.",
  [string]$RequiredCtx = "CodeQL",
  [int]   $WatchMins   = 5,
  [switch]$DeleteBranchAfter
)

$ErrorActionPreference = "Stop"

if (-not $HeadBranch) {
  throw "HeadBranch not provided and could not determine current branch via git."
}

Write-Host "Repo: $Repo"
Write-Host "Base: $BaseBranch"
Write-Host "Head: $HeadBranch"

# A) Set approvals -> 0
@{ required_approving_review_count = 0 } |
  ConvertTo-Json -Depth 6 |
  gh api --method PATCH -H "Accept: application/vnd.github+json" `
    "/repos/$Repo/branches/$BaseBranch/protection/required_pull_request_reviews" --input - | Out-Null
Write-Host "Approvals set to 0."

# B) Require a single passing context (strict ON)
@{ strict = $true; checks = @(@{ context = $RequiredCtx }) } |
  ConvertTo-Json -Depth 6 |
  gh api --method PATCH -H "Accept: application/vnd.github+json" `
    "/repos/$Repo/branches/$BaseBranch/protection/required_status_checks" --input - | Out-Null
Write-Host "Required status set to '$RequiredCtx' (strict=true)."

# C) Create or reuse PR
$prNum = gh pr list -R $Repo --head $HeadBranch --state open --json number --jq '.[0].number' 2>$null
if (-not $prNum) {
  gh pr create -R $Repo -B $BaseBranch -H $HeadBranch -t $Title -b $Body | Out-Null
  $prNum = gh pr list -R $Repo --head $HeadBranch --state open --json number --jq '.[0].number'
}
if (-not $prNum) { throw "Could not create or find an OPEN PR for $HeadBranch -> $BaseBranch." }

$prUrl = gh pr view $prNum -R $Repo --json url --jq .url
Write-Host ("Using PR #{0}: {1}" -f $prNum, $prUrl)

# D) Re-run the latest workflow for this head (optional but helpful)
#    Hardened: tolerate zero results and skip cleanly.
$runs = gh run list -R $Repo -L 40 --json databaseId,headBranch 2>$null | ConvertFrom-Json
$rid  = ($runs | Where-Object { $_.headBranch -eq $HeadBranch } |
         Sort-Object databaseId -Descending |
         Select-Object -First 1).databaseId

if ($rid) {
  try { gh run rerun $rid -R $Repo | Out-Null } catch { }
  try { gh run watch $rid -R $Repo } catch { }
} else {
  Write-Host "No existing workflow run found for head '$HeadBranch'; skipping rerun."
}

# E) Queue auto-merge (squash)
gh pr merge $prNum -R $Repo --squash --auto | Out-Null
Write-Host "Auto-merge queued."

# F) Ensure branch is up-to-date (server-side)
$cmp = gh api "/repos/$Repo/compare/$BaseBranch...$HeadBranch" | ConvertFrom-Json
if ($cmp.behind_by -gt 0) {
  Write-Host "Updating branch from $BaseBranch into $HeadBranch on server..."
  gh api -X PUT -H "Accept: application/vnd.github+json" "/repos/$Repo/pulls/$prNum/update-branch" | Out-Null
}

# G) Watch until merged (or time out)
$deadline = (Get-Date).AddMinutes($WatchMins)
while ((Get-Date) -lt $deadline) {
  $s = gh pr view $prNum -R $Repo --json state,mergeStateStatus,mergedAt | ConvertFrom-Json
  if ($s.mergedAt) {
    Write-Host ("Merged at {0}" -f $s.mergedAt)
    break
  }
  Write-Host ("{0} / {1}" -f $s.state, $s.mergeStateStatus)
  Start-Sleep 6
}

# H) Optionally delete branch
if ($DeleteBranchAfter) {
  try {
    git push origin --delete $HeadBranch 2>$null
    Write-Host "Deleted remote branch '$HeadBranch'."
  } catch {
    Write-Host "Could not delete '$HeadBranch' (maybe already gone)."
  }
}
