param([switch]$Smoke)

$ErrorActionPreference = "Stop"

function Out-Status([bool]$ok, [string]$label, $detail="") {
  if ($ok) { Write-Host "✓ $label" -ForegroundColor Green }
  else { Write-Host "✗ $label" -ForegroundColor Red }
  if ($detail) { Write-Host "  $detail" -ForegroundColor DarkGray }
}

# -- load vars / set region
$varsPath = Join-Path (Get-Location) "ops/vars.json"
if (!(Test-Path $varsPath)) { throw "ops/vars.json not found" }
$vars = Get-Content $varsPath -Raw | ConvertFrom-Json
if ($vars.region) { $env:AWS_REGION = $vars.region }

# -- names
$app   = if ($vars.appName) { $vars.appName } else { "lifebook" }
$stage = if ($vars.stage)   { $vars.stage }   else { "prod" }
$func  = "$app-heartbeat"
$rule  = "$app-heartbeat-hourly"

# -- local files sanity
Write-Host "`n== Local files ==" -ForegroundColor Cyan
@(
  "ops/ensure-heartbeat.ps1",
  "ops/presign-smoke.ps1",
  "ops/ensure-budgets.ps1",
  "ops/set-flag.ps1",
  "ops/feature-flags.json",
  "lib/flags.mjs"
) | ForEach-Object {
  $ok = Test-Path $_
  Out-Status $ok "file: $_"
}

# -- Lambda
Write-Host "`n== Lambda & schedule ==" -ForegroundColor Cyan
try {
  $cfg = (aws lambda get-function --function-name $func --output json | ConvertFrom-Json).Configuration
  Out-Status $true "lambda: $func" "runtime=$($cfg.Runtime); timeout=$($cfg.Timeout)s; role=$($cfg.Role)"
} catch { Out-Status $false "lambda: $func" $_.Exception.Message }

# -- rule
try {
  $rj = aws events describe-rule --name $rule --output json | ConvertFrom-Json
  $ruleArn = $rj.Arn
  Out-Status ($ruleArn -ne $null -and $ruleArn -ne "") "rule: $rule" $ruleArn
} catch { Out-Status $false "rule: $rule" $_.Exception.Message }

# -- targets
try {
  $t = (aws events list-targets-by-rule --rule $rule --output json | ConvertFrom-Json).Targets
  $count = ($t | Measure-Object).Count
  $tarn = if ($count -gt 0) { $t[0].Arn } else { "" }
  Out-Status ($count -ge 1) "rule target count: $count" $tarn
} catch { Out-Status $false "rule targets" $_.Exception.Message }

# -- log groups (expect 14d)
Write-Host "`n== Log groups (expect retention 14d) ==" -ForegroundColor Cyan
function Check-LG([string]$name) {
  try {
    $resp = aws logs describe-log-groups --log-group-name-prefix $name --output json | ConvertFrom-Json
    $lg = $resp.logGroups | Where-Object { $_.logGroupName -eq $name } | Select-Object -First 1
    if ($null -ne $lg) {
      Out-Status $true "log group: $name" "retention: $($lg.retentionInDays)"
      if ($lg.retentionInDays -ne 14) {
        Write-Host "  ⚠ set to 14d: aws logs put-retention-policy --log-group-name `"$name`" --retention-in-days 14" -ForegroundColor Yellow
      }
    } else {
      Out-Status $false "log group: $name" "not found"
    }
  } catch { Out-Status $false "log group: $name" $_.Exception.Message }
}
$expectedLGs = @(
  "/aws/lambda/$func",
  "/aws/lambda/lifebook-worker",
  "/aws/lambda/lifebook-presign"
)
$expectedLGs | ForEach-Object { Check-LG $_ }

# -- alarms
Write-Host "`n== Alarms ==" -ForegroundColor Cyan
$alarms = @("heartbeat-success-missing-or-zero","heartbeat-failure-detected")
foreach ($a in $alarms) {
  try {
    $aj = aws cloudwatch describe-alarms --alarm-names $a --output json | ConvertFrom-Json
    $alarm = $aj.MetricAlarms | Select-Object -First 1
    if ($null -ne $alarm) {
      $hasActions = (($alarm.AlarmActions | Measure-Object).Count -gt 0)
      Out-Status $true "alarm: $a" "state=$($alarm.StateValue); actions=$(if($hasActions){"yes"}else{"none"})"
    } else {
      Out-Status $false "alarm: $a" "not found"
    }
  } catch { Out-Status $false "alarm: $a" $_.Exception.Message }
}

# -- budget
Write-Host "`n== Budget ==" -ForegroundColor Cyan
$budgetName = "$app-$stage-monthly"
try {
  $bj = aws budgets describe-budget --account-id $($vars.accountId) --budget-name $budgetName --output json | ConvertFrom-Json
  $b = $bj.Budget
  if ($null -ne $b) {
    Out-Status $true "budget: $budgetName" "limit USD $($b.BudgetLimit.Amount)"
  } else {
    Out-Status $false "budget: $budgetName" "not found"
  }
} catch { Out-Status $false "budget: $budgetName" $_.Exception.Message }

# -- SSM flags (optional)
Write-Host "`n== SSM Flags ==" -ForegroundColor Cyan
$ssmPrefix = $null
if ($vars.ssm -and $vars.ssm.prefix) { $ssmPrefix = $vars.ssm.prefix }
if ($ssmPrefix) {
  try {
    $p = aws ssm get-parameters-by-path --path $ssmPrefix --with-decryption --recursive --output json | ConvertFrom-Json
    $n = ($p.Parameters | Measure-Object).Count
    Out-Status ($n -ge 1) "flags at $ssmPrefix" "count=$n"
  } catch { Out-Status $false "flags at $ssmPrefix" $_.Exception.Message }
} else {
  Write-Host "i no ssm.prefix in vars.json; skipping." -ForegroundColor Yellow
}

# -- optional smoke using your presign script
if ($Smoke) {
  Write-Host "`n== Smoke: presign → PUT → HEAD ==" -ForegroundColor Cyan
  if (Test-Path "ops/presign-smoke.ps1") {
    try {
      pwsh "ops/presign-smoke.ps1" | Out-Host
      Out-Status $true "smoke" "ok"
    } catch { Out-Status $false "smoke" $_.Exception.Message }
  } else {
    Out-Status $false "smoke" "ops/presign-smoke.ps1 not found"
  }
}

Write-Host "`nDone." -ForegroundColor Cyan
