param(
  [Parameter(Mandatory=$true)][string]$Webhook,
  [Parameter(Mandatory=$true)][string]$Title,
  [Parameter(Mandatory=$true)][string]$Status,
  [string]$RunUrl,
  [string]$Branch,
  [string]$Commit
)

$color = if ($Status -eq 'success') { 'good' } elseif ($Status -eq 'cancelled') { '#999999' } else { 'danger' }
$shortSha = if ($Commit) { $Commit.Substring(0,7) } else { '' }

$payload = @{
  attachments = @(
    @{
      color = $color
      title = $Title
      text  = "*Status:* $Status`n*Repo:* $env:GITHUB_REPOSITORY`n*Branch:* $Branch`n*Commit:* $shortSha`n<$RunUrl|Open run>"
      mrkdwn_in = @("text")
    }
  )
}

Invoke-RestMethod -Method POST -Uri $Webhook -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 6)
