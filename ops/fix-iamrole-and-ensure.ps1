$ErrorActionPreference = "Stop"

# 1) Load vars + set region
$varsPath = Join-Path (Get-Location) "ops/vars.json"
if (-not (Test-Path $varsPath)) { throw "ops/vars.json not found" }
$vars = Get-Content $varsPath -Raw | ConvertFrom-Json
if ($vars.region) { $env:AWS_REGION = $vars.region }

# 2) Resolve worker function role (default to lifebookai-worker)
$workerName = $vars.lambdas?.worker
if ([string]::IsNullOrWhiteSpace($workerName)) { $workerName = "lifebookai-worker" }

$roleArn = aws lambda get-function --function-name $workerName --query "Configuration.Role" --output text
if ([string]::IsNullOrWhiteSpace($roleArn) -or $roleArn -like "*NotFound*") {
  throw "Could not resolve role from Lambda '$workerName'. Check the name/region."
}

# 3) Upsert TOP-LEVEL iamRoleArn (PSCustomObject is sealed → use Add-Member -Force)
$vars | Add-Member -NotePropertyName iamRoleArn -NotePropertyValue $roleArn -Force
$vars | ConvertTo-Json -Depth 20 | Set-Content $varsPath -Encoding utf8
Write-Host "Updated ops/vars.json  iamRoleArn=$roleArn" -ForegroundColor Green

# 4) Re-run heartbeat ensure
if (-not (Test-Path "ops/ensure-heartbeat.ps1")) { throw "ops/ensure-heartbeat.ps1 not found. Run the heartbeat creator first." }
pwsh ops/ensure-heartbeat.ps1
