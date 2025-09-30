$ErrorActionPreference = "Stop"

# ===== Load vars =====
$varsPath = Join-Path (Get-Location) "ops/vars.json"
if (-not (Test-Path $varsPath)) { throw "ops/vars.json not found." }
$vars = Get-Content $varsPath -Raw | ConvertFrom-Json
$env:AWS_REGION = $vars.region

# Names
$app   = if ($vars.appName) { $vars.appName } else { "lifebook" }
$stage = if ($vars.stage)   { $vars.stage   } else { "prod" }
$acct  = $vars.accountId
$func  = "lifebook-heartbeat"
$rule  = "lifebook-heartbeat-hourly"
$budgetName = "$app-$stage-monthly"

Write-Host "`n== Ensure Heartbeat Lambda + schedule ==" -ForegroundColor Cyan
# prefer your existing deploy script
$ensureHeartbeat = ".\ops\ensure-heartbeat.ps1"
if (Test-Path $ensureHeartbeat) {
  pwsh $ensureHeartbeat
} else {
  throw "ops/ensure-heartbeat.ps1 not found (this script expects it to exist)."
}

# Confirm function exists and wire the EventBridge target (idempotent)
aws lambda wait function-exists --function-name $func | Out-Null
$funcArn = aws lambda get-function --function-name $func --query Configuration.FunctionArn --output text
if (-not $funcArn) { throw "Heartbeat Lambda ARN not resolved." }

aws events put-rule --name $rule --schedule-expression "rate(1 hour)" | Out-Null
$ruleArn = aws events describe-rule --name $rule --query Arn --output text
aws lambda add-permission --function-name $func --statement-id "events-$rule" --action "lambda:InvokeFunction" --principal events.amazonaws.com --source-arn $ruleArn 2>$null | Out-Null
$tmpTargets = New-TemporaryFile
@(@{ Id="1"; Arn=$funcArn }) | ConvertTo-Json | Out-File $tmpTargets -Encoding utf8
aws events put-targets --rule $rule --targets file://$tmpTargets | Out-Null
Remove-Item $tmpTargets -Force -ErrorAction Ignore

# ===== Ensure Budget (built-in) =====
function Ensure-Budget([string]$Name, [double]$Amount, [string]$Type="COST") {
  $budgetObj = @{
    BudgetName = $Name
    BudgetLimit = @{ Amount = ("{0:N2}" -f $Amount); Unit = "USD" }
    TimeUnit = "MONTHLY"
    BudgetType = $Type
    CostTypes = @{ IncludeTax=$true; IncludeSubscription=$true; UseAmortized=$false }
  }
  $notifs = @()
  foreach ($kind in @("ACTUAL","FORECASTED")) {
    foreach ($pct in 50,80,100,120) {
      $n = @{
        NotificationType   = $kind
        ComparisonOperator = "GREATER_THAN"
        ThresholdType      = "PERCENTAGE"
        Threshold          = $pct
      }
      if ($vars.sns -and $vars.sns.alarmsTopicArn) {
        $n["Subscribers"] = @(@{ SubscriptionType="SNS"; Address=$vars.sns.alarmsTopicArn })
      }
      $notifs += $n
    }
  }
  $tmpB = New-TemporaryFile
  ($budgetObj | ConvertTo-Json -Depth 6) | Out-File $tmpB -Encoding utf8
  $tmpN = New-TemporaryFile
  ($notifs   | ConvertTo-Json -Depth 6) | Out-File $tmpN -Encoding utf8
  try {
    aws budgets update-budget --account-id $acct --new-budget file://$tmpB --budget-name $Name | Out-Null
  } catch {
    try {
      if ($notifs.Count -gt 0) {
        aws budgets create-budget --account-id $acct --budget file://$tmpB --notifications-with-subscribers file://$tmpN | Out-Null
      } else {
        aws budgets create-budget --account-id $acct --budget file://$tmpB | Out-Null
      }
    } catch { Write-Warning $_.Exception.Message }
  } finally {
    Remove-Item $tmpB,$tmpN -Force -ErrorAction Ignore
  }
}
$amount = if ($vars.budgetUsd) { [double]$vars.budgetUsd } else { 300.0 }
Write-Host "`n== Ensure AWS Budget: $budgetName @ USD $amount ==" -ForegroundColor Cyan
Ensure-Budget -Name $budgetName -Amount $amount
try {
  $b = aws budgets describe-budget --account-id $acct --budget-name $budgetName --output json
  if ($b) { Write-Host "Budget visible via API." -ForegroundColor Green }
} catch { Write-Warning "Budget not yet visible via API (eventual consistency)."; }

# ===== One-time heartbeat to emit metrics =====
Write-Host "`n== Invoke heartbeat now ==" -ForegroundColor Cyan
aws lambda invoke --function-name $func --payload "{}" --cli-binary-format raw-in-base64-out .\tmp.heartbeat.out.json | Out-Null
Write-Host ("Heartbeat output: " + (Get-Content .\tmp.heartbeat.out.json -Raw))

# ===== Verify & smoke =====
$verify = ".\ops\verify-all.ps1"
if (Test-Path $verify) {
  Write-Host "`n== Verify & smoke ==" -ForegroundColor Cyan
  pwsh $verify -Smoke
} else {
  Write-Warning "ops/verify-all.ps1 not found."
}
