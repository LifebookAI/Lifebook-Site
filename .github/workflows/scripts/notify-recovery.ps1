param(
  [Parameter(Mandatory=$true)][string]$Webhook,
  [string]$WorkflowFile = "upload-smoke.yml",
  [string]$Branch = $env:GITHUB_REF_NAME
)

$repo  = $env:GITHUB_REPOSITORY
$runId = $env:GITHUB_RUN_ID
$token = $env:GITHUB_TOKEN

if (-not $token) {
  Write-Warning "GITHUB_TOKEN missing; skipping recovery notification."
  exit 0
}

$headers = @{
  Authorization         = "token $token"   # REST API expects 'token'
  Accept                = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

try {
  # Get the two latest runs for this workflow on this branch
  $uri  = "https://api.github.com/repos/$repo/actions/workflows/$WorkflowFile/runs?branch=$Branch&per_page=2"
  $resp = Invoke-RestMethod -Method GET -Headers $headers -Uri $uri

  $prev = $resp.workflow_runs | Where-Object { $_.id -ne [int64]$runId } | Select-Object -First 1
  if (-not $prev) { exit 0 }

  if ($prev.conclusion -eq "failure") {
    $runUrl = "https://github.com/$repo/actions/runs/$runId"
    . "$PSScriptRoot\notify-slack.ps1" `
      -Webhook $Webhook `
      -Title "✅ Upload smoke recovered" `
      -Status "success" `
      -RunUrl $runUrl `
      -Branch $Branch `
      -Commit $env:GITHUB_SHA
  }
}
catch {
  Write-Warning "Recovery check failed: $($_.Exception.Message)"
  # don't fail the job over a notification helper
  exit 0
}
