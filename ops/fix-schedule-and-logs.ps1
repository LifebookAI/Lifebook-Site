param()

$ErrorActionPreference = "Stop"

# --- Load config ---
$vars = Get-Content "ops/vars.json" -Raw | ConvertFrom-Json
if($vars.region){ $env:AWS_REGION = $vars.region }

$app   = if($vars.appName){ $vars.appName } else { "lifebook" }
$stage = if($vars.stage){ $vars.stage } else { "prod" }
$func  = "$app-heartbeat"
$rule  = "$app-$stage-heartbeat-hourly"

# --- Ensure Lambda exists (verify & get ARN) ---
try {
  $funcArn = aws lambda get-function --function-name $func --query Configuration.FunctionArn --output text
} catch {
  throw "Lambda '$func' not found; create it first."
}

# --- Ensure EventBridge schedule on default bus ---
aws events put-rule --name $rule --schedule-expression "rate(1 hour)" --state ENABLED | Out-Null
$ruleArn = aws events describe-rule --name $rule --query Arn --output text

# Permission for Events → Lambda (idempotent; ignore if exists)
try {
  aws lambda add-permission --function-name $func `
    --statement-id "events-$rule" `
    --action "lambda:InvokeFunction" `
    --principal events.amazonaws.com `
    --source-arn $ruleArn | Out-Null
} catch { }

# Target mapping (idempotent via put-targets)
$targets = @(@{ Id = "target1"; Arn = $funcArn })
$tmp = New-TemporaryFile
$targets | ConvertTo-Json -Depth 5 | Set-Content $tmp -Encoding utf8
aws events put-targets --rule $rule --targets file://$tmp | Out-Null
Remove-Item $tmp -Force -ErrorAction Ignore

Write-Host ("Attached target to rule {0} → {1}" -f $rule, $func) -ForegroundColor Cyan

# --- Ensure log groups exist & set retention 14d ---
function Ensure-LogGroup([string]$name) {
  try { aws logs create-log-group --log-group-name $name 2>$null | Out-Null } catch {}
  aws logs put-retention-policy --log-group-name $name --retention-in-days 14 | Out-Null
  Write-Host ("log group ok: {0} (retention 14d)" -f $name) -ForegroundColor DarkGray
}

$logs = @(
  "/aws/lambda/$func",
  "/aws/lambda/lifebookai-worker",
  "/aws/lambda/lifebook-presign"
)
$logs | ForEach-Object { Ensure-LogGroup $_ }

Write-Host "`nFixes applied." -ForegroundColor Green
