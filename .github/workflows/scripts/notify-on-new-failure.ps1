param(
  [Parameter(Mandatory=$true)][string]$Webhook,
  [string]$WorkflowFile = "upload-smoke.yml",
  [string]$Branch = $env:GITHUB_REF_NAME,
  [int]$SuppressHours = 6
)

$repo  = $env:GITHUB_REPOSITORY
$runId = [int64]$env:GITHUB_RUN_ID
$token = $env:GITHUB_TOKEN

if (-not $token) {
  Write-Warning "GITHUB_TOKEN missing; sending failure alert without dedupe."
  $runUrl = "https://github.com/$repo/actions/runs/$runId"
  . "$PSScriptRoot\notify-slack.ps1" -Webhook $Webhook -Title "🚨 Upload smoke failed" -Status "failure" -RunUrl $runUrl -Branch $Branch -Commit $env:GITHUB_SHA
  exit 0
}

$headers = @{
  Authorization         = "token $token"
  Accept                = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

try {
  $uri  = "https://api.github.com/repos/$repo/actions/workflows/$WorkflowFile/runs?branch=$Branch&per_page=2"
  $resp = Invoke-RestMethod -Method GET -Headers $headers -Uri $uri

  $prev = $resp.workflow_runs | Where-Object { $_.id -ne $runId } | Select-Object -First 1

  $shouldNotify = $true
  if ($prev -and $prev.conclusion -eq "failure") {
    $ageHrs = ([datetime]::UtcNow - [datetime]$prev.updated_at).TotalHours
    if ($ageHrs -lt $SuppressHours) { $shouldNotify = $false }
  }

  if ($shouldNotify) {
    $runUrl = "https://github.com/$repo/actions/runs/$runId"
    . "$PSScriptRoot\notify-slack.ps1" `
      -Webhook $Webhook `
      -Title "🚨 Upload smoke failed" `
      -Status "failure" `
      -RunUrl $runUrl `
      -Branch $Branch `
      -Commit $env:GITHUB_SHA
  } else {
    Write-Host "Skipping Slack failure alert (prior failure within $SuppressHours hours)."
  }
}
catch {
  Write-Warning "Dedupe check failed: $($_.Exception.Message); sending alert anyway."
  $runUrl = "https://github.com/$repo/actions/runs/$runId"
  . "$PSScriptRoot\notify-slack.ps1" -Webhook $Webhook -Title "🚨 Upload smoke failed" -Status "failure" -RunUrl $runUrl -Branch $Branch -Commit $env:GITHUB_SHA
}
