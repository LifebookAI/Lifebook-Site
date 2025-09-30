param()

$ErrorActionPreference = "Stop"

# --- Load vars.json ---
$varsPath = Join-Path (Get-Location) "ops/vars.json"
if (-not (Test-Path $varsPath)) { throw "ops/vars.json not found." }
$vars = Get-Content $varsPath -Raw | ConvertFrom-Json

function Pick([string[]]$cands) {
  ($cands | Where-Object { $_ -and $_.Trim() -ne "" } | Select-Object -First 1)
}

$REGION   = $vars.region
$STAGE    = if ($vars.stage) { $vars.stage } else { "prod" }
$CF_BASE  = Pick @($vars.cloudfrontBase)
$API_BASE = Pick @(
  $vars.presign.apiBase,
  $vars.presign.base,
  ($(if ($vars.api -and $vars.api.base -and $vars.presign -and $vars.presign.path) { $vars.api.base.TrimEnd('/') + '/' + $vars.presign.path.TrimStart('/') }))
)
$API_KEY  = $vars.presign.apiKey
$HMAC_HEX = $vars.presign.hmacHex

if (-not $API_BASE) { throw "Missing presign base. Add presign.apiBase (or api.base + presign.path) to ops/vars.json." }
if (-not $API_KEY)  { throw "Missing presign.apiKey in ops/vars.json." }
if (-not $HMAC_HEX) { throw "Missing presign.hmacHex in ops/vars.json." }
if (-not $CF_BASE)  { throw "Missing cloudfrontBase in ops/vars.json." }

# Discover a role ARN (re-use worker's role if you didn't specify one)
$ROLE_ARN = $vars.iamRoleArn
if (-not $ROLE_ARN -and $vars.lambdas -and $vars.lambdas.worker) {
  try { $ROLE_ARN = aws lambda get-function --function-name $($vars.lambdas.worker) --query Configuration.Role --output text } catch {}
}
if (-not $ROLE_ARN) { throw "Could not determine Lambda role ARN. Put it in ops/vars.json as iamRoleArn or ensure lifebook-worker exists." }

$env:AWS_REGION = $REGION

# --- Paths/workspace ---
$root = Get-Location
$hbDir = Join-Path $root "heartbeat"
if (-not (Test-Path $hbDir)) { New-Item -ItemType Directory -Path $hbDir | Out-Null }
Set-Location $hbDir

# --- Write minimal index.mjs + package.json (safe to overwrite) ---
@"
import crypto from 'crypto';
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

const cw = new CloudWatchClient();
const NS = "Lifebook/Heartbeat";

function need(k){ const v = process.env[k]; if(!v) throw new Error(\`Missing env: \${k}\`); return v; }

export const handler = async () => {
  const PRESIGN_API_BASE = need("PRESIGN_API_BASE");
  const PRESIGN_API_KEY  = need("PRESIGN_API_KEY");
  const HMAC_SECRET_HEX  = need("PRESIGN_HMAC_SECRET");
  const CF_BASE          = need("CF_BASE");
  const STAGE            = process.env.STAGE || "prod";

  const key = \`sources/heartbeat/\${new Date().toISOString().replace(/[:.]/g,"-")}.txt\`;
  const body = { key, contentType: "text/plain", contentDisposition: "inline" };
  const ts = Math.floor(Date.now()/1000).toString();
  const sig = crypto.createHmac("sha256", Buffer.from(HMAC_SECRET_HEX,"hex")).update(\`\${ts}.\${JSON.stringify(body)}\`).digest("hex");

  const headers = { "content-type":"application/json", "x-api-key":PRESIGN_API_KEY, "x-timestamp":ts, "x-signature":sig };
  const putMetric = async (name, dims=[]) => cw.send(new PutMetricDataCommand({
    Namespace: NS, MetricData: [{ MetricName: name, Unit: "Count", Value: 1, Dimensions: [...dims, {Name:"stage",Value:STAGE}]}]
  }));

  try {
    // 1) presign
    const pres = await fetch(PRESIGN_API_BASE, { method:"POST", headers, body: JSON.stringify(body) });
    if (!pres.ok) throw new Error(\`presign failed: \${pres.status}\`);
    const j = await pres.json();
    const uploadUrl = j.url || j.presign?.uploadUrl || j.signedUrl;
    const uploadHeaders = j.headers || j.presign?.headers || {};
    if (!uploadUrl) throw new Error("presign response missing url");

    // 2) PUT ~1KB
    const payload = "heartbeat " + new Date().toISOString() + "\\n";
    const putRes = await fetch(uploadUrl, { method:"PUT", headers: { "content-type":"text/plain", ...uploadHeaders }, body: payload });
    if (![200,201,204].includes(putRes.status)) throw new Error(\`PUT failed: \${putRes.status}\`);

    // 3) HEAD via CloudFront
    const cfUrl = CF_BASE.replace(/\/+$/,"") + "/" + key;
    const head = await fetch(cfUrl, { method:"HEAD" });
    if (!head.ok) throw new Error(\`CF HEAD failed: \${head.status}\`);

    await putMetric("HeartbeatSuccess", [{Name:"Step",Value:"end-to-end"}]);
    return { ok:true, key, cfUrl };
  } catch (e) {
    await putMetric("HeartbeatFailure", [{Name:"Reason",Value:String(e.message).slice(0,200)}]);
    throw e;
  }
};
"@ | Out-File .\index.mjs -Encoding utf8

@"
{
  "name": "lifebook-heartbeat",
  "version": "0.1.2",
  "type": "module",
  "private": true,
  "dependencies": {
    "@aws-sdk/client-cloudwatch": "^3.637.0"
  }
}
"@ | Out-File .\package.json -Encoding utf8

# --- Install & package ---
npm i | Out-Null
if (Test-Path ..\heartbeat.zip) { Remove-Item ..\heartbeat.zip -Force -ErrorAction Ignore }
Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath ..\heartbeat.zip
Set-Location $root

# --- Create/Update Lambda ---
$FUNC = "lifebook-heartbeat"
$exists = $false
try { aws lambda get-function --function-name $FUNC --query Configuration.FunctionArn --output text | Out-Null; $exists = $true } catch {}

if (-not $exists) {
  aws lambda create-function --function-name $FUNC `
    --runtime nodejs20.x `
    --role $ROLE_ARN `
    --handler index.handler `
    --timeout 30 `
    --memory-size 256 `
    --zip-file fileb://heartbeat.zip | Out-Null
} else {
  aws lambda update-function-code --function-name $FUNC --zip-file fileb://heartbeat.zip | Out-Null
}

# --- Environment variables (done via JSON file to avoid quoting issues) ---
$envObj = @{
  Variables = @{
    PRESIGN_API_BASE   = $API_BASE
    PRESIGN_API_KEY    = $API_KEY
    PRESIGN_HMAC_SECRET= $HMAC_HEX
    CF_BASE            = $CF_BASE
    STAGE              = $STAGE
  }
}
$tmpEnv = New-TemporaryFile
$envObj | ConvertTo-Json -Compress | Out-File $tmpEnv -Encoding utf8
aws lambda update-function-configuration --function-name $FUNC --environment file://$tmpEnv | Out-Null
Remove-Item $tmpEnv -Force -ErrorAction Ignore

# --- Wait until function is active ---
aws lambda wait function-active --function-name $FUNC

# --- EventBridge hourly rule + permission + target ---
$RULE = "lifebook-heartbeat-hourly"
aws events put-rule --name $RULE --schedule-expression "rate(1 hour)" | Out-Null
$RULE_ARN = aws events describe-rule --name $RULE --query Arn --output text
$FUNC_ARN = aws lambda get-function --function-name $FUNC --query Configuration.FunctionArn --output text

# allow EB to invoke (ignore if already exists)
aws lambda add-permission --function-name $FUNC `
  --statement-id "events-$RULE" `
  --action "lambda:InvokeFunction" `
  --principal events.amazonaws.com `
  --source-arn $RULE_ARN 2>$null | Out-Null

# set target (via file for reliability)
$tmpTargets = New-TemporaryFile
@(@{ Id = "ok-heartbeat"; Arn = $FUNC_ARN }) | ConvertTo-Json | Out-File $tmpTargets -Encoding utf8
aws events put-targets --rule $RULE --targets file://$tmpTargets | Out-Null
Remove-Item $tmpTargets -Force -ErrorAction Ignore

# --- Ensure log retention 14d for heartbeat + existing worker/presign ---
function Ensure-LogGroup([string]$name){
  try {
    $cnt = aws logs describe-log-groups --log-group-name-prefix "$name" --query "logGroups[?logGroupName=='$name'] | length(@)" --output text
    if ($cnt -eq "0" -or $cnt -eq "None") { aws logs create-log-group --log-group-name $name | Out-Null }
  } catch {}
  aws logs put-retention-policy --log-group-name $name --retention-in-days 14 | Out-Null
}
$lg = @("/aws/lambda/$($vars.lambdas.worker)","/aws/lambda/$($vars.lambdas.presign)","/aws/lambda/$FUNC") | Where-Object { $_ -and $_ -ne "/aws/lambda/" }
$lg | ForEach-Object { Ensure-LogGroup $_ }

Write-Host "`nHeartbeat deployed & scheduled:" $FUNC -ForegroundColor Green
Write-Host "Rule: $RULE  -> target:" (aws events list-targets-by-rule --rule $RULE --query "Targets[].Arn" --output text)
