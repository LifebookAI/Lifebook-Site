param()

$ErrorActionPreference = "Stop"

function Out-Ok($msg){ Write-Host "✓ $msg" -ForegroundColor Green }
function Out-Warn($msg){ Write-Warning $msg }
function Out-Step($msg){ Write-Host "`n== $msg ==" -ForegroundColor Cyan }

# Load vars
$varsPath = Join-Path (Get-Location) "ops/vars.json"
if (!(Test-Path $varsPath)) { throw "ops/vars.json not found" }
$vars = Get-Content $varsPath -Raw | ConvertFrom-Json
if ($vars.region) { $env:AWS_REGION = $vars.region }

$stage   = if ($vars.stage) { $vars.stage } else { "prod" }
$app     = if ($vars.appName) { $vars.appName } else { "lifebook" }
$snsArn  = $vars.sns.alarmsTopicArn
$acct    = $vars.accountId

# ---- CloudWatch alarms (HeartbeatSuccess / HeartbeatFailure) ----
Out-Step "CloudWatch alarms (wire SNS if provided)"

function Put-Alarm([string]$name,[string]$metric,[int]$threshold,[string]$cmp,[int]$periodSec,[string]$treatMissing=""){
  $args = @(
    "--alarm-name", $name,
    "--namespace", "Lifebook/Heartbeat",
    "--metric-name", $metric,
    "--statistic", "Sum",
    "--period", $periodSec, "--evaluation-periods", 1,
    "--threshold", $threshold, "--comparison-operator", $cmp
  )
  if ($treatMissing) { $args += @("--treat-missing-data", $treatMissing) }
  $dims = @{ Name="Stage"; Value=$stage } | ConvertTo-Json
  $args += @("--dimensions", $dims)

  if ($snsArn) { $args += @("--alarm-actions", $snsArn) }

  aws cloudwatch put-metric-alarm @args | Out-Null
  Out-Ok "alarm: $name (actions: $([string]::IsNullOrEmpty($snsArn) ? "none" : "sns"))"
}

Put-Alarm "heartbeat-success-missing-or-zero" "HeartbeatSuccess" 1 "LessThanThreshold" 3600 "breaching"
Put-Alarm "heartbeat-failure-detected"       "HeartbeatFailure"  0 "GreaterThanThreshold" 3600 ""

# ---- Budgets (50/80/100/120%, ACTUAL + FORECAST) ----
Out-Step "AWS Budgets (ACTUAL + FORECAST 50/80/100/120%)"
$budgetName = "$app-$stage-monthly"
$amount = if ($vars.budgetUsd) { [double]$vars.budgetUsd } else { 300.0 }

$common = @{
  BudgetName = $budgetName
  BudgetLimit = @{ Amount = "$amount"; Unit = "USD" }
  TimeUnit = "MONTHLY"
  BudgetType = "COST"
  CostTypes = @{ IncludeTax=$true; IncludeSubscription=$true; UseAmortized=$false }
  NotificationsWithSubscribers = @()
}

$thresholds = @(50,80,100,120)
foreach ($t in $thresholds) {
  foreach ($ty in @("ACTUAL","FORECASTED")) {
    $notif = @{
      Notification = @{
        NotificationType = $ty
        ComparisonOperator = "GREATER_THAN"
        Threshold = $t
        ThresholdType = "PERCENTAGE"
      }
      Subscribers = @()
    }
    if ($snsArn) { $notif.Subscribers = @(@{ SubscriptionType="SNS"; Address=$snsArn }) }
    $common.NotificationsWithSubscribers += $notif
  }
}

# Try update, else create
$tmp = New-TemporaryFile
try {
  $common | ConvertTo-Json -Depth 8 | Out-File $tmp -Encoding utf8
  aws budgets update-budget --account-id $acct --new-budget-file "file://$tmp" --budget-name $budgetName | Out-Null
  Out-Ok "updated budget: $budgetName (SNS wired: $([string]::IsNullOrEmpty($snsArn) ? "no" : "yes"))"
} catch {
  try {
    aws budgets create-budget --account-id $acct --budget-file "file://$tmp" | Out-Null
    Out-Ok "created budget: $budgetName (SNS wired: $([string]::IsNullOrEmpty($snsArn) ? "no" : "yes"))"
  } finally { Remove-Item $tmp -ErrorAction Ignore }
}

# ---- (Optional) kick the heartbeat once now to clear the 'missing' alarm ----
Out-Step "Invoke heartbeat once (optional)"
try {
  aws lambda invoke --function-name lifebook-heartbeat --payload '{}' $env:TEMP\hb.out.json | Out-Null
  Out-Ok "invoked lifebook-heartbeat"
} catch { Out-Warn "Could not invoke lifebook-heartbeat ($_)" }

Write-Host "`nDone." -ForegroundColor Green
