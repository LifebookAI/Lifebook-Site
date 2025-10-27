param([ValidateSet("QuickVerify")]$Mode="QuickVerify")
$ErrorActionPreference='Stop'

function Get-Region { if($env:AWS_REGION){$env:AWS_REGION} elseif($env:AWS_DEFAULT_REGION){$env:AWS_DEFAULT_REGION} else {'us-east-1'} }

$acct   = (aws sts get-caller-identity | ConvertFrom-Json).Account
$region = Get-Region
$topicArn = "arn:aws:sns:$region:$acct:lifebook-alerts"

# KMS rotation (aliases we care about)
$aliases = @('alias/lifebook-synthetics','alias/lifebook-s3-prod')
$kms = @()
foreach($a in $aliases){
  $kid = aws kms list-aliases --query "Aliases[?AliasName=='$a'].TargetKeyId" --output text 2>$null
  if($kid){
    $st = aws kms get-key-rotation-status --key-id $kid | ConvertFrom-Json
    $kms += [pscustomobject]@{ alias=$a; on=($st.KeyRotationEnabled -eq $true) }
  } else {
    $kms += [pscustomobject]@{ alias=$a; on=$null }
  }
}

# EventBridge nightly smoke rule exists (state may be ENABLED/DISABLED)
$rb = aws events describe-rule --name lifebook-cw-alarm-smoke-nightly `
      --query '{State:State,Schedule:ScheduleExpression}' 2>$null | ConvertFrom-Json

# SNS topic policy: Ensure AllowEventBridge does NOT have empty ArnEquals SourceArn
$tp = (aws sns get-topic-attributes --topic-arn $topicArn | ConvertFrom-Json).Attributes.Policy | ConvertFrom-Json
$emptyEb = @($tp.Statement | Where-Object {
  $_.Sid -eq 'AllowEventBridge' -and $_.Condition -and $_.Condition.ArnEquals -and
  @($_.Condition.ArnEquals.'aws:SourceArn').Count -eq 0
}).Count -gt 0

# CloudFront: no behaviors forward Host header
$dists = aws cloudfront list-distributions --output json 2>$null | ConvertFrom-Json
$items = @($dists.DistributionList.Items) | Where-Object { $_ }
$hostFwd = $false
foreach($d in $items){
  $cfg = aws cloudfront get-distribution-config --id $d.Id --output json 2>$null | ConvertFrom-Json
  $dc  = $cfg.DistributionConfig
  $behaviors = @()
  if ($dc.DefaultCacheBehavior) { $behaviors += $dc.DefaultCacheBehavior | Add-Member NoteProperty PathPattern '(default)' -PassThru }
  if ($dc.CacheBehaviors.Items) { $behaviors += $dc.CacheBehaviors.Items }
  foreach ($b in $behaviors) {
    if ($b.OriginRequestPolicyId) {
      $orp = aws cloudfront get-origin-request-policy --id $b.OriginRequestPolicyId --output json 2>$null | ConvertFrom-Json
      $hdrCfg = $orp.OriginRequestPolicy.OriginRequestPolicyConfig.HeadersConfig
      $mode = $hdrCfg.HeaderBehavior; $hdrs = @($hdrCfg.Headers.Items)
      if ($mode -eq 'allViewer' -or ($mode -eq 'whitelist' -and ($hdrs -match '^host$' -or $hdrs -match '^:authority$'))) { $hostFwd = $true }
    } else {
      $fv = $b.ForwardedValues
      if ($fv -and $fv.Headers) {
        $hItems = @($fv.Headers.Items)
        if ($hItems -match '^Host$' -or $hItems -match '^:authority$') { $hostFwd = $true }
      }
    }
  }
}

$ok = ($kms | Where-Object { $_.on -ne $true }).Count -eq 0 -and $rb -and $rb.State -in 'ENABLED','DISABLED' -and -not $emptyEb -and -not $hostFwd

$summary = [pscustomobject]@{
  account=$acct; region=$region
  kms=$kms
  events=$rb
  snsAllowEventBridgeArnEqualsEmpty=$emptyEb
  cloudfrontHostForwarded=$hostFwd
}

$summary | ConvertTo-Json -Depth 10 | Write-Output
if($ok){ exit 0 } else { exit 1 }
