$ErrorActionPreference="Stop"

function Ok($m){Write-Host "✓ $m" -ForegroundColor Green}
function Warn($m){Write-Host "⚠ $m" -ForegroundColor Yellow}
function Bad($m){Write-Host "✗ $m" -ForegroundColor Red}

# Load vars
$varsPath = Join-Path (Get-Location) "ops/vars.json"
if (!(Test-Path $varsPath)) { throw "ops/vars.json not found" }
$vars = Get-Content $varsPath -Raw | ConvertFrom-Json
if ($vars.region) { $env:AWS_REGION = $vars.region }

$app   = if ($vars.appName) { $vars.appName } else { "lifebook" }
$stage = if ($vars.stage)   { $vars.stage }   else { "prod" }
$FUNC  = "$app-heartbeat"
$RULE  = "$app-heartbeat-hourly"

# 1) Ensure EventBridge target -> Lambda
try {
  $funcArn = aws lambda get-function --function-name $FUNC --query Configuration.FunctionArn --output text
  if (-not $funcArn) { throw "Lambda not found: $FUNC" }
  $ruleArn = aws events describe-rule --name $RULE --query Arn --output text
  if (-not $ruleArn) {
    aws events put-rule --name $RULE --schedule-expression "rate(1 hour)" | Out-Null
    $ruleArn = aws events describe-rule --name $RULE --query Arn --output text
  }
  aws lambda add-permission --function-name $FUNC --statement-id "events-$RULE" --action "Lambda:InvokeFunction" --principal events.amazonaws.com --source-arn $ruleArn 2>$null | Out-Null
  $targetsFile = New-TemporaryFile
  '[{"Id":"target","Arn":"'+$funcArn+'"}]' | Set-Content $targetsFile -Encoding utf8
  aws events put-targets --rule $RULE --targets file://$targetsFile | Out-Null
  Remove-Item $targetsFile -Force -ErrorAction Ignore
  $count = (aws events list-targets-by-rule --rule $RULE --query 'Targets | length(@)' --output text)
  if ([int]$count -ge 1) { Ok "Attached target to rule $RULE → $FUNC" } else { Bad "rule still has 0 targets" }
} catch { Bad "rule target fix failed: $($_.Exception.Message)" }

# 2) (optional) Add SNS actions to alarms if provided
if ($vars.sns -and $vars.sns.alarmsTopicArn) {
  $sns = $vars.sns.alarmsTopicArn
  $ns  = "Lifebook/Heartbeat"
  try {
    aws cloudwatch put-metric-alarm --alarm-name "heartbeat-success-missing-or-zero" `
      --metric-name "HeartbeatSuccess" --namespace $ns --statistic Sum `
      --period 3600 --evaluation-periods 1 --threshold 1 --comparison-operator LessThanThreshold `
      --treat-missing-data breaching --alarm-actions $sns | Out-Null
    aws cloudwatch put-metric-alarm --alarm-name "heartbeat-failure-detected" `
      --metric-name "HeartbeatFailure" --namespace $ns --statistic Sum `
      --period 3600 --evaluation-periods 1 --threshold 0 --comparison-operator GreaterThanThreshold `
      --treat-missing-data notBreaching --alarm-actions $sns | Out-Null
    Ok "Alarms ensured with SNS actions → $sns"
  } catch { Warn "Could not update alarms with SNS: $($_.Exception.Message)" }
} else {
  Warn "No sns.alarmsTopicArn in vars.json; leaving alarms without actions."
}

# 3) Ensure Budget (uses your local script if present)
if (Test-Path "ops/ensure-budgets.ps1") {
  try { pwsh "ops/ensure-budgets.ps1" | Out-Host } catch { Warn "ensure-budgets.ps1 failed: $($_.Exception.Message)" }
} else { Warn "ops/ensure-budgets.ps1 not found; skipping budget creation." }

# 4) Re-run verify (with smoke)
if (Test-Path "ops/verify-heartbeat.ps1") { pwsh "ops/verify-heartbeat.ps1" -Smoke | Out-Host } else { Warn "verify script missing" }
