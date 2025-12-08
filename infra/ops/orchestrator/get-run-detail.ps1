[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$JobId
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 0) Basic context
$Profile      = 'lifebook-sso'
$Region       = 'us-east-1'
$JobsTable    = 'lifebook-orchestrator-jobs'
$RunLogsTable = 'lifebook-orchestrator-run-logs'

if (-not $JobId -or -not $JobId.Trim()) {
  throw "JobId is empty. Provide -JobId '<job-id>'."
}

Write-Host "Fetching RunDetail for JobId=$JobId ..." -ForegroundColor Cyan

# 1) Fetch job from lifebook-orchestrator-jobs
$keyJson = "{`"pk`":{`"S`":`"$JobId`"},`"sk`":{`"S`":`"job`"}}"

$jobJson = aws dynamodb get-item `
  --table-name $JobsTable `
  --key $keyJson `
  --output json `
  --profile $Profile `
  --region $Region

if ($LASTEXITCODE -ne 0) {
  throw "dynamodb get-item for JobsTable failed (see error above)."
}

$jobResp = $jobJson | ConvertFrom-Json

if (-not $jobResp.Item) {
  Write-Host "No job item found for JobId=$JobId in table $JobsTable." -ForegroundColor Red
  return
}

$jobItem = $jobResp.Item

$workflowSlug = $jobItem.workflowSlug.S
$status       = $jobItem.status.S
$createdAt    = $jobItem.createdAt.S
$updatedAt    = $jobItem.updatedAt.S
$lastError    = $null
if ($jobItem.PSObject.Properties.Name -contains 'lastError') {
  $lastError = $jobItem.lastError.S
}

Write-Host ""
Write-Host "=== Job summary ===" -ForegroundColor Green
Write-Host ("JobId        : {0}" -f $JobId)
Write-Host ("WorkflowSlug : {0}" -f $workflowSlug)
Write-Host ("Status       : {0}" -f $status)
Write-Host ("CreatedAt    : {0}" -f $createdAt)
Write-Host ("UpdatedAt    : {0}" -f $updatedAt)
if ($lastError) {
  Write-Host ("LastError    : {0}" -f $lastError) -ForegroundColor Red
}

# 2) Fetch run logs from lifebook-orchestrator-run-logs
Write-Host ""
Write-Host "Querying run logs from $RunLogsTable ..." -ForegroundColor Yellow

$exprValues = "{`":jobId`":{`"S`":`"$JobId`"}}"

$logsJson = aws dynamodb query `
  --table-name $RunLogsTable `
  --key-condition-expression "jobId = :jobId" `
  --expression-attribute-values $exprValues `
  --output json `
  --profile $Profile `
  --region $Region

if ($LASTEXITCODE -ne 0) {
  throw "dynamodb query for RunLogsTable failed (see error above)."
}

$logsResp = $logsJson | ConvertFrom-Json

if (-not $logsResp.Items -or $logsResp.Items.Count -eq 0) {
  Write-Host "No run-log items found for JobId=$JobId in table $RunLogsTable." -ForegroundColor Red

  $runDetailNoLogs = [PSCustomObject]@{
    JobId        = $JobId
    WorkflowSlug = $workflowSlug
    Status       = $status
    CreatedAt    = $createdAt
    UpdatedAt    = $updatedAt
    LastError    = $lastError
    RunLogs      = @()
  }

  Write-Host ""
  Write-Host "RunDetail JSON (no logs):" -ForegroundColor Green
  $runDetailNoLogs | ConvertTo-Json -Depth 5
  return
}

# 3) Sort logs by createdAt (best-effort timeline)
$logItems = $logsResp.Items | Sort-Object {
  $createdAttr = $_.createdAt
  if ($createdAttr -and $createdAttr.S) {
    try {
      [datetime]::Parse($createdAttr.S)
    } catch {
      $createdAttr.S
    }
  } else {
    ""
  }
}

Write-Host ""
Write-Host ("Found {0} run-log item(s)." -f $logItems.Count) -ForegroundColor Green
Write-Host ""
Write-Host "=== Run log timeline ===" -ForegroundColor Green

$runLogs = @()

foreach ($item in $logItems) {
  $entryJobId = $item.jobId.S
  $step       = $item.step.S
  $message    = $item.message.S
  $created    = $item.createdAt.S

  $statusBefore = $null
  if ($item.PSObject.Properties.Name -contains 'statusBefore') {
    $statusBefore = $item.statusBefore.S
  }

  $statusAfter = $null
  if ($item.PSObject.Properties.Name -contains 'statusAfter') {
    $statusAfter = $item.statusAfter.S
  }

  $statusSegment =
    if ($statusBefore -and $statusAfter) {
      "[$statusBefore -> $statusAfter]"
    } elseif ($statusAfter) {
      "[-> $statusAfter]"
    } else {
      ""
    }

  Write-Host ("{0} | {1} {2}" -f $created, $step, $statusSegment) -ForegroundColor Yellow
  Write-Host ("  {0}" -f $message)
  Write-Host ""

  $runLogs += [PSCustomObject]@{
    JobId        = $entryJobId
    Step         = $step
    Message      = $message
    StatusBefore = $statusBefore
    StatusAfter  = $statusAfter
    CreatedAt    = $created
  }
}

# 4) Build a RunDetail-style object and print JSON
$runDetail = [PSCustomObject]@{
  JobId        = $JobId
  WorkflowSlug = $workflowSlug
  Status       = $status
  CreatedAt    = $createdAt
  UpdatedAt    = $updatedAt
  LastError    = $lastError
  RunLogs      = $runLogs
}

Write-Host "=== RunDetail JSON ===" -ForegroundColor Green
$runDetail | ConvertTo-Json -Depth 5
