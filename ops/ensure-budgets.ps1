param()
$ErrorActionPreference="Stop"

# --- Load vars ---
$varsPath = Join-Path (Get-Location) "ops/vars.json"
if(!(Test-Path $varsPath)){ throw "ops/vars.json not found" }
$vars = Get-Content $varsPath -Raw | ConvertFrom-Json

$acct = if($vars.accountId){$vars.accountId}else{throw "Set accountId in ops/vars.json"}
$app  = if($vars.appName){$vars.appName}else{"lifebook"}
$stage= if($vars.stage){$vars.stage}else{"prod"}
$bn   = if($vars.budgetName){$vars.budgetName}else{"$app-$stage-monthly"}

# sanity: who am I
$whoAcct = (aws sts get-caller-identity --query 'Account' --output text) 2>$null
if($whoAcct -and $whoAcct -ne $acct){ Write-Warning "CLI account ($whoAcct) != vars.json accountId ($acct)" }

# amount must be a STRING
$amt = if($vars.budgetUsd){ [double]$vars.budgetUsd } else { 300.0 }
$amtStr = ("{0}" -f $amt).Replace(',','.')

$snsArn = $null; try { $snsArn = $vars.sns.alarmsTopicArn } catch {}

# upsert budget
$budget = @{
  BudgetName  = $bn
  BudgetLimit = @{ Amount = $amtStr; Unit = "USD" }
  TimeUnit    = "MONTHLY"
  BudgetType  = "COST"
  CostFilters = @{}
  CostTypes   = @{ IncludeTax=$true; IncludeSubscription=$true; UseAmortized=$false }
}
$tmp = New-TemporaryFile
$budget | ConvertTo-Json -Depth 6 | Out-File $tmp -Encoding utf8

$mode="updated"
try { aws budgets update-budget --account-id $acct --new-budget file://$tmp | Out-Null }
catch { aws budgets create-budget --account-id $acct --budget file://$tmp | Out-Null; $mode="created" }
Remove-Item $tmp -Force -ErrorAction Ignore

# wait/verify
$desc=$null; for($i=0;$i -lt 20;$i++){
  try { $desc = aws budgets describe-budget --account-id $acct --budget-name $bn --query "Budget.[BudgetName,BudgetLimit.Amount]" --output text 2>$null; if($desc){ break } } catch {}
  Start-Sleep -Seconds 3
}

# notifications (only if real SNS ARN)
if($snsArn -and $snsArn -like "arn:aws:sns:*"){
  $notifs=@()
  foreach($t in "ACTUAL","FORECASTED"){
    foreach($pct in 50,80,100,120){
      $notifs += @{
        Notification=@{ NotificationType=$t; ComparisonOperator="GREATER_THAN"; Threshold=$pct; ThresholdType="PERCENTAGE" }
        Subscribers=@(@{ SubscriptionType="SNS"; Address=$snsArn })
      }
    }
  }
  $tn = New-TemporaryFile
  $notifs | ConvertTo-Json -Depth 6 | Out-File $tn -Encoding utf8
  aws budgets update-notifications-for-budget --account-id $acct --budget-name $bn --notifications-with-subscribers file://$tn | Out-Null
  Remove-Item $tn -Force -ErrorAction Ignore
}

if($desc){ Write-Host ("Ensured budget: {0}  (mode: {1}; SNS wired: {2})" -f $desc,$mode,[bool]$snsArn) -ForegroundColor Green }
else{ Write-Warning "Budget describe still not visible via API; open Budgets console to confirm." }

aws budgets describe-budgets --account-id $acct --query "Budgets[].{name:BudgetName,amount:BudgetLimit.Amount}" --output table 2>$null
