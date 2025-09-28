param([switch]$Smoke)
$ErrorActionPreference="Stop"

function Ok($ok,$label,[string]$detail=''){
  $color='DarkGray'; $prefix='·'
  if($ok){ $color='Green'; $prefix='✓' }
  if([string]::IsNullOrWhiteSpace($detail)){ Write-Host ("{0} {1}" -f $prefix,$label) -ForegroundColor $color }
  else { Write-Host ("{0} {1} {2}" -f $prefix,$label,$detail) -ForegroundColor $color }
}
function Fail($label,[string]$detail=''){ if($detail){ Write-Host ("✗ {0} {1}" -f $label,$detail) -ForegroundColor Red } else { Write-Host ("✗ {0}" -f $label) -ForegroundColor Red } }
function Info($k,$v){ Write-Host ("  {0}: {1}" -f $k,$v) -ForegroundColor Cyan }

# Load vars
$vars = Get-Content "ops/vars.json" -Raw | ConvertFrom-Json
if($vars.region){ $env:AWS_REGION=$vars.region }
$app   = if($vars.appName){$vars.appName}else{"lifebook"}
$stage = if($vars.stage){$vars.stage}else{"prod"}
$func  = "$app-heartbeat"
$rule  = "$app-$stage-heartbeat-hourly"
$budgetName = if($vars.budgetName){$vars.budgetName}else{"$app-$stage-monthly"}

Write-Host "`n== Local files ==" -ForegroundColor Cyan
"ops/ensure-heartbeat.ps1","ops/presign-smoke.ps1","ops/ensure-budgets.ps1","lib/flags.mjs","ops/set-flag.ps1" |
  ForEach-Object { Ok (Test-Path $_) "file:" $_ }

Write-Host "`n== Lambda & schedule ==" -ForegroundColor Cyan
try{
  $cfg = aws lambda get-function --function-name $func --query "Configuration.{runtime:Runtime,timeout:Timeout,role:Role}" --output json | ConvertFrom-Json
  if($cfg){ Ok $true "lambda:" $func; Info runtime $cfg.runtime; Info timeout $cfg.timeout; Info role $cfg.role } else { Fail "lambda" $func }
}catch{ Fail "lambda" $func; Write-Host $_.Exception.Message -ForegroundColor DarkGray }

try{
  $ruleArn = aws events describe-rule --name $rule --query Arn --output text
  $targets = aws events list-targets-by-rule --rule $rule --query "Targets[].Id" --output json | ConvertFrom-Json
  if($ruleArn){ Ok $true "rule:" $rule; Info "target count" ( ($targets|Measure-Object).Count ) } else { Fail "rule" $rule }
}catch{ Fail "rule" $rule; Write-Host $_.Exception.Message -ForegroundColor DarkGray }

Write-Host "`n== Log groups (expect retention 14d) ==" -ForegroundColor Cyan
$groups = "/aws/lambda/lifebook-heartbeat","/aws/lambda/lifebookai-worker","/aws/lambda/lifebook-presign"
foreach($g in $groups){
  try{
    $ret = aws logs describe-log-groups --log-group-name-prefix $g --query "logGroups[?logGroupName=='`$g'].retentionInDays" --output text
    if([string]::IsNullOrWhiteSpace($ret)){ $ret="(none)"; Ok $false "log group:" $g; Info retention $ret }
    else { Ok ($ret -eq '14') "log group:" $g; Info retention $ret }
  }catch{ Ok $false "log group:" $g }
}

Write-Host "`n== Alarms ==" -ForegroundColor Cyan
$an1="$app-$stage-success-missing-or-zero"; $an2="$app-$stage-failure-detected"
foreach($a in @($an1,$an2)){
  try{
    $st = aws cloudwatch describe-alarms --alarm-names $a --query "MetricAlarms[0].{state:StateValue,actions:AlarmActions}" --output json | ConvertFrom-Json
    if($st){ Ok $true "alarm:" $a; Info state $st.state; Info actions ($(if($st.actions -and $st.actions.Count){'sns'}else{'none'})) }
    else { Fail "alarm" $a }
  }catch{ Fail "alarm" $a }
}

Write-Host "`n== Budget ==" -ForegroundColor Cyan
try{
  $b = aws budgets describe-budget --account-id $($vars.accountId) --budget-name $budgetName --query "Budget.[BudgetName,BudgetLimit.Amount]" --output text
  if($b){ Ok $true "budget:" $b } else { Fail "budget" $budgetName }
}catch{ Fail "budget" $budgetName; Write-Host $_.Exception.Message -ForegroundColor DarkGray }

if($Smoke){
  Write-Host "`n== Smoke: presign PUT + HEAD ==" -ForegroundColor Cyan
  if(Test-Path "ops/presign-smoke.ps1"){ pwsh ops/presign-smoke.ps1 } else { Write-Host "skip: ops/presign-smoke.ps1 missing" -ForegroundColor DarkGray }
}
