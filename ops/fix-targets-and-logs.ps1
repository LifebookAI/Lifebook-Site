param()
$ErrorActionPreference = "Stop"
function Say($m,$c="Gray"){Write-Host $m -ForegroundColor $c}

# --- Load vars / region ---
$varsPath = Join-Path (Get-Location) "ops/vars.json"
if (-not (Test-Path $varsPath)) { throw "ops/vars.json not found" }
$vars = Get-Content $varsPath -Raw | ConvertFrom-Json
if ($vars.region) { $env:AWS_REGION = $vars.region }

# --- Names ---
$app   = if ($vars.appName) { $vars.appName } else { "lifebook" }
$stage = if ($vars.stage)   { $vars.stage }   else { "prod" }
$func  = "$app-heartbeat"
$rule  = "$app-$stage-heartbeat-hourly"

# --- Ensure Lambda exists; get ARN ---
$funcArn = aws lambda get-function --function-name $func --query "Configuration.FunctionArn" --output text 2>$null
if ([string]::IsNullOrWhiteSpace($funcArn)) { throw "Lambda '$func' not found. Run ops/ensure-heartbeat.ps1 first." }

# --- Ensure / fetch rule (idempotent) ---
try { aws events describe-rule --name $rule | Out-Null }
catch { Say "Rule '$rule' missing; creating..." Cyan; aws events put-rule --name $rule --schedule-expression "rate(1 hour)" | Out-Null }
$ruleArn = aws events describe-rule --name $rule --query Arn --output text

# --- Permission (ignore if it already exists) ---
try {
  aws lambda add-permission --function-name $func `
    --statement-id "events-$rule" `
    --action "lambda:InvokeFunction" `
    --principal events.amazonaws.com `
    --source-arn $ruleArn | Out-Null
} catch {
  if ($_.Exception.Message -notmatch 'ResourceConflictException') { throw }
}

# --- Attach target: write JSON WITHOUT BOM, force array wrapper ---
$targets = @(@{ Id = "lifeHook"; Arn = $funcArn })
$targetsJson = $targets | ConvertTo-Json -Depth 3 -Compress
if (-not $targetsJson.Trim().StartsWith("[")) { $targetsJson = "[$targetsJson]" }

$tmp = New-TemporaryFile
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($tmp, $targetsJson, $utf8NoBom)
try {
  aws events put-targets --rule $rule --targets file://$tmp | Out-Null
} finally { Remove-Item $tmp -Force -ErrorAction Ignore }

Say "Attached target to rule: $rule -> $func" Green
aws events list-targets-by-rule --rule $rule --query "Targets[].{id:Id,arn:Arn}" --output table

# --- Log groups: ensure 14d retention (prepare several likely names) ---
function Ensure-LogRetention([string]$name,[int]$days=14){
  if ([string]::IsNullOrWhiteSpace($name)) { return }
  $desc = aws logs describe-log-groups --log-group-name-prefix $name | ConvertFrom-Json
  $exists = ($desc.logGroups | Where-Object logGroupName -eq $name | Select-Object -First 1)
  if (-not $exists) { aws logs create-log-group --log-group-name $name 2>$null | Out-Null }
  aws logs put-retention-policy --log-group-name $name --retention-in-days $days | Out-Null
  $desc2 = aws logs describe-log-groups --log-group-name-prefix $name | ConvertFrom-Json
  $ret = (($desc2.logGroups | Where-Object logGroupName -eq $name | Select-Object -First 1).retentionInDays)
  Say ("log group: {0}   retention: {1}" -f $name, ($ret ? "$ret`d" : "(none)"))
}

$logs = @("/aws/lambda/$func")

# Try both possible worker/presign names plus values from vars.json
$workers  = @($vars.lambdas.worker, "lifebookai-worker","lifebook-worker") | Where-Object { $_ } | Select-Object -Unique
$presigns = @($vars.lambdas.presign, "lifebook-presign") | Where-Object { $_ } | Select-Object -Unique
$logs += $workers  | ForEach-Object { "/aws/lambda/$_" }
$logs += $presigns | ForEach-Object { "/aws/lambda/$_" }

$logs = $logs | Select-Object -Unique
$logs | ForEach-Object { Ensure-LogRetention $_ 14 }

Say "`nDone." Green
