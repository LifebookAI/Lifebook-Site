param(
  [string]$Profile        = 'lifebook-sso',
  [string]$Region         = 'us-east-1',
  [string]$Bucket         = 'lifebook.ai',
  [string]$DistributionId = 'E2D7FJLA6YQUNP',
  [string]$PreferredHost  = 'files.uselifebook.ai',
  [switch]$NoCommit
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $d = Split-Path -Parent $Path
  if ($d -and -not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function To-Array($x) {
  if ($null -eq $x) { return @() }
  if ($x -is [System.Array]) { return $x }
  return @($x)
}

function Get-HttpStatusFromException([object]$ex) {
  try {
    $resp = $ex.Response
    if ($resp -and $resp.StatusCode) { return [int]$resp.StatusCode }
  } catch { }
  return $null
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) { throw "aws CLI not found." }

# Ensure SSO is valid
try { aws sts get-caller-identity --profile $Profile --region $Region *> $null }
catch { aws sso login --profile $Profile | Out-Host }

# Discover CloudFront host (prefer alias)
$cf = aws cloudfront get-distribution --id $DistributionId --profile $Profile | ConvertFrom-Json
$CfDomain = $cf.Distribution.DomainName

$AliasItems = $null
try { $AliasItems = $cf.Distribution.DistributionConfig.Aliases.Items } catch { $AliasItems = $null }

# IMPORTANT: force array materialization so ".Count" always exists
$CfAliases = @(To-Array $AliasItems | Where-Object { $_ })

$CfHost = if ($CfAliases -contains $PreferredHost) { $PreferredHost } else { $CfDomain }

Write-Host ("CloudFront Domain: {0}" -f $CfDomain) -ForegroundColor DarkGray
if ($CfAliases.Count -gt 0) { Write-Host ("CloudFront Aliases: " + ($CfAliases -join ', ')) -ForegroundColor DarkGray }
Write-Host ("CloudFront Host selected: {0}" -f $CfHost) -ForegroundColor Cyan

# Get bucket default KMS key
$enc = aws s3api get-bucket-encryption --bucket $Bucket --profile $Profile --region $Region | ConvertFrom-Json
$kmsKeyId = $enc.ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.KMSMasterKeyID
Write-Host ("S3 KMS KeyId: {0}" -f $kmsKeyId) -ForegroundColor DarkGray

# PUT object (SSE-KMS)
$ts  = (Get-Date).ToString('yyyyMMdd_HHmmss')
$key = "synthetic/aws-e2e/$ts.txt"
$tmp = Join-Path $env:TEMP "lifebook_aws_e2e_$ts.txt"
"lifebook aws e2e $ts" | Set-Content -LiteralPath $tmp -Encoding utf8

aws s3api put-object `
  --bucket $Bucket `
  --key $key `
  --body $tmp `
  --server-side-encryption aws:kms `
  --ssekms-key-id $kmsKeyId `
  --metadata purpose=aws-e2e,ts=$ts `
  --profile $Profile `
  --region $Region | Out-Null

Write-Host ("S3 PUT OK: s3://{0}/{1}" -f $Bucket, $key) -ForegroundColor Green

# HEAD via CloudFront (retry for propagation)
$uri  = "https://$CfHost/$key"
$ok   = $false
$last = $null

for ($i=0; $i -lt 30; $i++) {
  try {
    $r = Invoke-WebRequest -Method Head -Uri $uri -TimeoutSec 10
    $last = [int]$r.StatusCode
    if ($last -ge 200 -and $last -lt 400) { $ok = $true; break }
  } catch {
    $scode = Get-HttpStatusFromException $_.Exception
    $last = if ($scode) { $scode } else { $_.Exception.Message }
  }
  Start-Sleep -Seconds 2
}

if ($ok) {
  Write-Host ("CloudFront HEAD OK: {0} ({1})" -f $uri, $last) -ForegroundColor Green
} else {
  throw "CloudFront HEAD failed after retries. Uri=$uri Last=$last"
}

Write-Host "DONE: E2E S3(KMS) -> CloudFront is GREEN." -ForegroundColor Green