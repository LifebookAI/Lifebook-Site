$ErrorActionPreference = "Stop"

# Detect account/region (PS 5.1-safe)
$acct   = (aws sts get-caller-identity | ConvertFrom-Json).Account
$region = $env:AWS_REGION; if (-not $region) { $region = $env:AWS_DEFAULT_REGION }; if (-not $region) { $region = "us-east-1" }
$env:AWS_REGION = $env:AWS_DEFAULT_REGION = $region

$tfvars = ".\ev11.auto.tfvars"
$snsTf  = ".\sns_policy.tf"

function RemoveAllVarBlock([string]$Text,[string]$Name){
  $pat = "(?ms)^\s*$([regex]::Escape($Name))\s*=\s*\[(?:.|\r?\n)*?\]\s*(?:\r?\n)?"
  [regex]::Replace($Text,$pat,"",'Singleline, Multiline')
}
function AppendVarLine([string]$Text,[string]$Name,[string]$ValueLiteral){
  if ($Text -notmatch "(`r`n|`n)$") { $Text += "`r`n" }
  $Text + "$Name = $ValueLiteral`r`n"
}
function PrintKV { param($k,$v); "{0,-24} {1}" -f $k,$v }

Write-Host "`n== Production Green (Idempotent) ==" -ForegroundColor Cyan
Write-Host (PrintKV "Account:" $acct)
Write-Host (PrintKV "Region:"  $region)

# One-time HCL deprecation patch (safe to re-run)
if (Test-Path $snsTf) {
  $hcl = Get-Content $snsTf -Raw
  $new = $hcl -replace '\$\{data\.aws_region\.current\.name\}', '${var.region}'
  if ($new -ne $hcl) { $new | Set-Content $snsTf -Encoding UTF8; Write-Host "Patched $snsTf (use var.region)." -Foreground Yellow }
}

# Refresh tfvars from live AWS (EventBridge rules + FailedInvocations alarms)
if (-not (Test-Path $tfvars)) { New-Item -ItemType File -Path $tfvars -Force | Out-Null }
$raw = Get-Content $tfvars -Raw
$raw = RemoveAllVarBlock -Text $raw -Name 'eventbridge_rule_arns'
$raw = RemoveAllVarBlock -Text $raw -Name 'smoke_alarm_names'

$rules  = aws events list-rules --query "Rules[?starts_with(Name,'lifebook')].Arn" --output json 2>$null | ConvertFrom-Json
$rules  = @($rules)  | Where-Object { $_ }
$alarms = aws cloudwatch describe-alarms --query "MetricAlarms[?contains(AlarmName,'FailedInvocations')].AlarmName" --output json 2>$null | ConvertFrom-Json
$alarms = @($alarms) | Where-Object { $_ }

$ruleList  = if ($rules)  { '[ ' + (($rules  | ForEach-Object { '"{0}"' -f $_ }) -join ', ') + ' ]' } else { '[]' }
$alarmList = if ($alarms) { '[ ' + (($alarms | ForEach-Object { '"{0}"' -f $_ }) -join ', ') + ' ]' } else { '[]' }

$raw = AppendVarLine -Text $raw -Name 'eventbridge_rule_arns' -ValueLiteral $ruleList
$raw = AppendVarLine -Text $raw -Name 'smoke_alarm_names'     -ValueLiteral $alarmList
$raw | Set-Content $tfvars -Encoding UTF8
Write-Host ("Updated {0} (rules={1}, alarms={2})" -f $tfvars, ($rules.Count), ($alarms.Count)) -Foreground Yellow

# Plan once; apply only if needed
terraform fmt -recursive | Out-Null
$planFile = ".\tfplan"; if (Test-Path $planFile) { Remove-Item $planFile -Force }
$null = & terraform plan -out $planFile -detailed-exitcode
switch ($LASTEXITCODE) {
  0 { Write-Host "Terraform: no changes (skipping apply)." -Foreground Green }
  2 {
    Write-Host "Terraform: changes detected → applying..." -Foreground Yellow
    & terraform apply -auto-approve $planFile
    if ($LASTEXITCODE -ne 0) { throw "terraform apply failed" }
  }
  default { throw "terraform plan failed with exit code $LASTEXITCODE" }
}

# Post-apply verification
$topicArn = "arn:aws:sns:${region}:${acct}:lifebook-alerts"
$keyArn   = (terraform output -raw kms_key_arn) 2>$null
if (-not $keyArn) {
  $kid = aws kms list-aliases --query "Aliases[?AliasName=='alias/lifebook-synthetics'].TargetKeyId" --output text
  if ($kid) { $keyArn = "arn:aws:kms:${region}:${acct}:key/$kid" }
}

Write-Host "`nVerification:" -Foreground Cyan
Write-Host (PrintKV "SNS Topic:" $topicArn)
if ($keyArn) { Write-Host (PrintKV "KMS Key:"   $keyArn) }

# (a) No empty ArnEquals in AllowEventBridge
$tp = (aws sns get-topic-attributes --topic-arn $topicArn | ConvertFrom-Json).Attributes.Policy | ConvertFrom-Json
$emptyEb = @($tp.Statement | Where-Object {
  $_.Sid -eq 'AllowEventBridge' -and $_.Condition -and $_.Condition.ArnEquals -and @($_.Condition.ArnEquals.'aws:SourceArn').Count -eq 0
})
if ($emptyEb.Count) { Write-Host "SNS policy has empty ArnEquals (unexpected)." -Foreground Red; exit 2 } else { Write-Host "SNS policy OK (no empty ArnEquals)." -Foreground Green }

# (b) Rotation
if ($keyArn) {
  $rot = (aws kms get-key-rotation-status --key-id $keyArn | ConvertFrom-Json).KeyRotationEnabled
  Write-Host (PrintKV "KMS Rotation:" ($rot ? "ENABLED" : "DISABLED")) -Foreground ($rot ? "Green" : "Yellow")
}

# (c) EB rule
$rb = aws events describe-rule --name lifebook-cw-alarm-smoke-nightly --query '{State:State,Schedule:ScheduleExpression}' 2>$null | ConvertFrom-Json
if ($rb) { Write-Host (PrintKV "Smoke Rule:" ("{0} ({1})" -f $rb.State,$rb.Schedule)) -Foreground ($rb.State -eq "ENABLED" ? "Green" : "Yellow") }

# (d) Subscribers
$subs = aws sns list-subscriptions-by-topic --topic-arn $topicArn --query "Subscriptions[].{Protocol:Protocol,Endpoint:Endpoint,Confirmed:SubscriptionArn!='PendingConfirmation'}" --output json | ConvertFrom-Json
$unconfirmed = @($subs | Where-Object { -not $_.Confirmed })
if ($unconfirmed.Count) { Write-Host "Unconfirmed SNS subscriptions detected." -Foreground Yellow } else { Write-Host "All SNS subscriptions confirmed." -Foreground Green }

Write-Host "`nPRODUCTION GREEN ✅"
