param([switch]$Smoke)

$ErrorActionPreference='Stop'

# === Load vars ===
$varsPath = Join-Path (Get-Location) 'ops/vars.json'
if(-not (Test-Path $varsPath)){ throw "ops/vars.json not found" }
$vars = Get-Content $varsPath -Raw | ConvertFrom-Json
if($vars.region){ $env:AWS_REGION = $vars.region }

# Names
$app   = if($vars.appName){ $vars.appName } else { 'lifebook' }
$stage = if($vars.stage){   $vars.stage   } else { 'prod' }
$func  = "$app-heartbeat"                   # (no stage in existing name)
$rule  = "$app-heartbeat-hourly"            # (matches what you already have)
$bn    = "$app-$stage-monthly"

# Optional SNS for alarms/budgets
$snsArn = $null
try { $snsArn = $vars.sns.alarmsTopicArn } catch {}

function Put-Alarm([string]$name,[string]$metric,[int]$threshold,[string]$cmp,[int]$periodSec,[string]$treatMissing=''){
  $args=@('--alarm-name',$name,'--namespace','Lifebook/Heartbeat','--metric-name',$metric,
          '--statistic','Sum','--period',$periodSec,'--evaluation-periods','1',
          '--threshold',$threshold,'--comparison-operator',$cmp)
  if($treatMissing){ $args += @('--treat-missing-data',$treatMissing) }
  if($snsArn -and $snsArn -like 'arn:aws:sns:*'){ $args += @('--alarm-actions',$snsArn) }
  aws cloudwatch put-metric-alarm @args | Out-Null
}

Write-Host "== Re-put CloudWatch alarms (wire SNS if present) ==" -ForegroundColor Cyan
Put-Alarm "$app-$stage-success-missing-or-zero" 'HeartbeatSuccess' 1 'LessThanThreshold' 3600 'breaching'
Put-Alarm "$app-$stage-failure-detected"       'HeartbeatFailure' 0 'GreaterThanThreshold' 3600

$alarmInfo = aws cloudwatch describe-alarms --alarm-names `
 "$app-$stage-success-missing-or-zero" "$app-$stage-failure-detected" --output json | ConvertFrom-Json
$alarmInfo.MetricAlarms | ForEach-Object {
  $wired = if($_.AlarmActions.Count -gt 0){'yes'} else {'no'}
  Write-Host ("  {0}  state={1}  sns-wired={2}" -f $_.AlarmName,$_.StateValue,$wired)
}

# Ensure Budget (if your ensure script exists)
if(Test-Path 'ops/ensure-budgets.ps1'){ pwsh ops/ensure-budgets.ps1 }

Write-Host "`n== Lambda & schedule ==" -ForegroundColor Cyan
aws lambda get-function --function-name $func --query "Configuration.[Runtime,Timeout,Role]" --output text

Write-Host "`n== Rule & targets ==" -ForegroundColor Cyan
$ruleArn = aws events describe-rule --name $rule --query Arn --output text
$targs   = aws events list-targets-by-rule --rule $rule --query "Targets[].Arn" --output text
Write-Host ("rule: {0}`nrule target count: {1}" -f $ruleArn, ($targs -split "`n" | ? {$_} | Measure-Object).Count)

Write-Host "`n== Log groups (expect retention 14d) ==" -ForegroundColor Cyan
$lg = @("/aws/lambda/$func")
try { if($vars.lambdas.worker){ $lg += "/aws/lambda/$($vars.lambdas.worker)" } } catch {}
try { if($vars.lambdas.presign){ $lg += "/aws/lambda/$($vars.lambdas.presign)" } } catch {}
$lg | ForEach-Object {
  $ret = aws logs describe-log-groups --log-group-name-prefix $_ --query "logGroups[0].retentionInDays" --output text
  Write-Host ("log group: {0}`n  retention: {1}" -f $_, $ret)
}

Write-Host "`n== Budget ==" -ForegroundColor Cyan
try {
  aws budgets describe-budget --account-id $($vars.accountId) --budget-name $bn `
    --query "Budget.[BudgetName,BudgetLimit.Amount]" --output text
} catch { Write-Warning "Budget '$bn' not found." }

if($Smoke){ Write-Host "`n== Smoke = Presign PUT + HEAD ==" -ForegroundColor Cyan; pwsh ops/presign-smoke.ps1 }
