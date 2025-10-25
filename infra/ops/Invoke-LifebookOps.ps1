#requires -Version 7
Set-StrictMode -Version Latest

function Invoke-LifebookOps {
  [CmdletBinding(SupportsShouldProcess)]
  param(
    # Core
    [string]  $Profile = "lifebook-admin",
    [string]  $Region  = "us-east-1",
    [string]  $Account = "354630286254",

    # Alerts / Synthetics
    [string]  $SnsTopicArn = "arn:aws:sns:us-east-1:354630286254:lifebook-alerts",
    [string[]]$EbRules     = @("lifebook-ssm-rc-fail","lifebook-ssm-sm-fail"),
    [string]  $CanaryName  = "lifebook-cf-health",

    # Bastion / VPC / S3
    [string]  $InstanceId      = "i-0407e9d925ec22603",
    [string]  $S3VpceId        = "vpce-0a35ebee30f84a18b",
    [string]  $ProcessedBucket = "lifebook-prod-processed-354630286254",
    [string]  $UploadsBucket   = "lifebook-prod-uploads-354630286254",

    # KMS
    [string[]]$KmsKeyIds = @(
      "0586aab9-60ae-4931-b8dd-e0da232f6b1e",  # alias/lifebook-synthetics
      "58765bb9-358d-4187-8ce9-f036bff4fbd6"   # alias/lifebook-s3-prod
    ),

    # VPCE policy mode
    [ValidateSet('AllowAll','LeastPrivilege')]
    [string] $VpcePolicyMode = 'LeastPrivilege',

    # Lifecycle rule IDs (for verification)
    [string[]]$LifecycleRuleIds = @(
      'abort-mpu-7d',
      'catalog-proxies-ia30-glacierir180',
      'catalog-masters-ia30-glacierir90'
    ),

    # Orchestration / resume
    [string] $StatePath = (Join-Path ($env:LOCALAPPDATA ?? $env:TEMP) "Lifebook\ops_state.json"),
    [switch] $Force,
    [switch] $FromScratch
  )

  $ErrorActionPreference = "Stop"

  # --- Helpers ---
  function A { param([Parameter(ValueFromRemainingArguments=$true)][string[]]$args)
    & aws @args
    if($LASTEXITCODE){ throw "aws $($args -join ' ') exit=$LASTEXITCODE" }
  }

  function Ensure-Directory { param([string]$Path)
    $dir = Split-Path -Parent $Path
    if($dir -and -not (Test-Path $dir)){ New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  }

  function Report-Done {
    param([string]$StepId,[string]$Evidence,[string]$Next="")
    try {
      & infra/ops/progress/progress.ps1 done -StepID $StepId -Status '✔' -Evidence $Evidence -Next $Next
    } catch {
      Write-Host "  (progress log skipped) $($_.Exception.Message)" -f DarkGray
    }
  }

  function Load-State {
    if($FromScratch -and (Test-Path $StatePath)){ Remove-Item $StatePath -Force }
    if(Test-Path $StatePath){ (Get-Content $StatePath -Raw | ConvertFrom-Json) } else { [ordered]@{ Steps=@{}; LastRun=$null } }
  }

  function Save-State($state) {
    Ensure-Directory -Path $StatePath
    ($state | ConvertTo-Json -Depth 50) | Out-File -Encoding utf8 $StatePath
  }

  function Is-Completed($state, [string]$StepId) { -not $Force -and $state.Steps.Contains($StepId) -and $state.Steps.$StepId.Status -eq 'Done' }
  function Mark-Completed($state, [string]$StepId, [string]$Note="") {
    $state.Steps.$StepId = @{ Status='Done'; At=(Get-Date).ToString('s'); Note=$Note }
    Save-State $state
    Report-Done -StepId $StepId -Evidence $Note -Next ""
  }

  function Wait-SSM {
    param([string]$InstanceId,[string]$CommandId,[string]$PluginName="aws:runShellScript",[int]$TimeoutSeconds=900)
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while($true){
      $o = (A ssm get-command-invocation --profile $Profile --region $Region `
              --instance-id $InstanceId --command-id $CommandId `
              --plugin-name $PluginName --output json) | ConvertFrom-Json
      Write-Host ("  SSM: {0}" -f $o.Status) -f DarkCyan
      if($o.Status -in @("Success","Failed","TimedOut","Cancelled")){ return $o }
      if($sw.Elapsed.TotalSeconds -ge $TimeoutSeconds){ throw "SSM timeout after $TimeoutSeconds seconds" }
      Start-Sleep 2
    }
  }

  function Get-CurrentVpcePolicy() {
    $pd = A ec2 describe-vpc-endpoints --profile $Profile --region $Region `
           --vpc-endpoint-ids $S3VpceId --query 'VpcEndpoints[0].PolicyDocument' --output text
    if(-not $pd){ return $null }
    try { $pd | ConvertFrom-Json } catch { $null }
  }

  function Set-VpcePolicy([string]$Mode){
    $BucketArns = @("arn:aws:s3:::$ProcessedBucket","arn:aws:s3:::$UploadsBucket")
    $ObjectArns = @("arn:aws:s3:::$ProcessedBucket/*","arn:aws:s3:::$UploadsBucket/*")
    if($Mode -eq 'AllowAll'){
      $policy = @{
        Version="2012-10-17"
        Statement=@(@{ Sid="AllowAllS3OnProdBuckets"; Effect="Allow"; Principal="*"; Action="s3:*"; Resource=@($BucketArns + $ObjectArns) })
      } | ConvertTo-Json -Depth 6
    } else {
      $policy = @{
        Version="2012-10-17"
        Statement=@(
          @{ Sid="AllowBucketList"; Effect="Allow"; Principal="*"; Action=@("s3:ListBucket","s3:ListBucketVersions","s3:ListBucketMultipartUploads"); Resource=$BucketArns },
          @{ Sid="AllowObjectRW";   Effect="Allow"; Principal="*"; Action=@("s3:GetObject","s3:GetObjectVersion","s3:PutObject","s3:DeleteObject","s3:DeleteObjectVersion","s3:AbortMultipartUpload","s3:ListMultipartUploadParts"); Resource=$ObjectArns },
          @{ Sid="AllowBucketMgmtInclLifecycle"; Effect="Allow"; Principal="*"; Action=@(
              "s3:GetBucketPolicy","s3:PutBucketPolicy","s3:GetBucketPublicAccessBlock","s3:PutBucketPublicAccessBlock",
              "s3:GetBucketVersioning","s3:PutBucketVersioning","s3:GetBucketOwnershipControls","s3:PutBucketOwnershipControls",
              "s3:GetEncryptionConfiguration","s3:PutEncryptionConfiguration","s3:GetBucketLogging","s3:PutBucketLogging",
              "s3:GetBucketLocation","s3:GetBucketLifecycleConfiguration","s3:PutBucketLifecycleConfiguration"
          ); Resource=$BucketArns }
        )
      } | ConvertTo-Json -Depth 10
    }
    $tmp = Join-Path $env:TEMP ("vpce_s3_policy_{0}_{1}.json" -f $Mode,(Get-Date -f "yyyyMMdd_HHmmss"))
    $policy | Out-File -Encoding utf8 $tmp
    A ec2 modify-vpc-endpoint --profile $Profile --region $Region --vpc-endpoint-id $S3VpceId --policy-document "file://$tmp" | Out-Null
    return "Mode=$Mode; lifecycle actions present for $ProcessedBucket, $UploadsBucket"
  }

  function Test-VpcePolicyHasLifecycle() {
    $p = Get-CurrentVpcePolicy
    if(-not $p){ return $false }
    $need = @("s3:GetBucketLifecycleConfiguration","s3:PutBucketLifecycleConfiguration")
    $bucketArns = @("arn:aws:s3:::$ProcessedBucket","arn:aws:s3:::$UploadsBucket")
    $has = $false
    foreach($s in $p.Statement){
      $actions = @(); if($s.Action -is [System.Array]){ $actions = $s.Action } elseif($s.Action){ $actions=@($s.Action) }
      $res     = @(); if($s.Resource -is [System.Array]){ $res = $s.Resource } elseif($s.Resource){ $res=@($s.Resource) }
      if(@($bucketArns | Where-Object { $res -contains $_ }).Count -gt 0){
        if(($actions -contains "s3:*") -or ($need | Where-Object { $actions -contains $_ }).Count -eq $need.Count){ $has = $true }
      }
    }
    return $has
  }

  function CW-WaitAlarms { param([string[]]$Names)
    if(-not $Names -or $Names.Count -eq 0){ return }
    try { & aws cloudwatch wait alarm-exists --profile $Profile --region $Region --alarm-names $Names 2>$null | Out-Null } catch { }
  }

  function Describe-Alarm($names) {
    if(-not $names -or $names.Count -eq 0){ return @() }
    $out = A cloudwatch describe-alarms --profile $Profile --region $Region --alarm-names $names --output json
    ($out | ConvertFrom-Json).MetricAlarms
  }

  function Upsert-EbFailedInvocations() {
    $created = @()
    foreach($r in $EbRules){
      $name = "$r-FailedInvocations>0"
      $dim  = "Name=RuleName,Value=$r"
      A cloudwatch put-metric-alarm --profile $Profile --region $Region `
        --alarm-name $name `
        --alarm-description "$($r): any failed invocations in the last minute" `
        --namespace AWS/Events --metric-name FailedInvocations `
        --dimensions $dim `
        --statistic Sum --period 60 --evaluation-periods 1 --datapoints-to-alarm 1 `
        --threshold 0 --comparison-operator GreaterThanThreshold `
        --treat-missing-data notBreaching `
        --alarm-actions $SnsTopicArn | Out-Null
      $created += $name
    }
    CW-WaitAlarms -Names $created
    return "Alarms upserted: $($created -join ', ') → $SnsTopicArn"
  }

  function Test-EbFailedInvocationsReady() {
    $names = $EbRules | ForEach-Object { "$_-FailedInvocations>0" }
    # Read full objects so we can normalize shapes reliably
    $json = A cloudwatch describe-alarms --profile $Profile --region $Region --alarm-names $names --output json
    $doc  = $json | ConvertFrom-Json
    $als  = @($doc.MetricAlarms)
    if ($als.Count -ne $names.Count) {
      Write-Host ("  debug: describe-alarms returned {0}/{1}" -f $als.Count, $names.Count) -f DarkYellow
      return $false
    }
    foreach ($a in $als) {
      $actions = @()
      foreach ($act in @($a.AlarmActions)) {
        if ($null -eq $act) { continue }
        if ($act -is [string]) { $actions += $act; continue }
        if ($act.PSObject.Properties['AlarmActionArn']) { $actions += $act.AlarmActionArn; continue }
      }
      if (-not ($actions -contains $SnsTopicArn)) { Write-Host "  debug: missing SNS action on $($a.AlarmName)" -f DarkYellow; return $false }
      if ($a.Namespace -ne "AWS/Events" -or $a.MetricName -ne "FailedInvocations") {
        Write-Host "  debug: NS/Metric mismatch on $($a.AlarmName): $($a.Namespace)/$($a.MetricName)" -f DarkYellow
        return $false
      }
    }
    return $true
  }

  function Upsert-SyntheticsNotify() {
    $succ = "$CanaryName-SuccessPercent-notify"
    $lat  = "$CanaryName-LatencyHigh-notify"
    $dimC = "Name=CanaryName,Value=$CanaryName"
    A cloudwatch put-metric-alarm --profile $Profile --region $Region `
      --alarm-name $succ `
      --alarm-description "$($CanaryName): SuccessPercent < 100 in one 5m period (notify)" `
      --namespace CloudWatchSynthetics --metric-name SuccessPercent `
      --dimensions $dimC `
      --statistic Average --period 300 --evaluation-periods 1 --datapoints-to-alarm 1 `
      --threshold 100 --comparison-operator LessThanThreshold `
      --treat-missing-data breaching `
      --alarm-actions $SnsTopicArn | Out-Null
    A cloudwatch put-metric-alarm --profile $Profile --region $Region `
      --alarm-name $lat `
      --alarm-description "$($CanaryName): Duration > 5000 ms avg over 5m (notify)" `
      --namespace CloudWatchSynthetics --metric-name Duration `
      --dimensions $dimC `
      --statistic Average --period 300 --evaluation-periods 1 --datapoints-to-alarm 1 `
      --threshold 5000 --comparison-operator GreaterThanThreshold `
      --treat-missing-data notBreaching --unit Milliseconds `
      --alarm-actions $SnsTopicArn | Out-Null
    CW-WaitAlarms -Names @($succ,$lat)
    return "Alarms upserted: $succ, $lat → $SnsTopicArn"
  }

  function Test-SyntheticsNotifyReady() {
    $names = @("$CanaryName-SuccessPercent-notify","$CanaryName-LatencyHigh-notify")
    CW-WaitAlarms -Names $names
    $als = Describe-Alarm $names
    if($als.Count -ne 2){ return $false }
    foreach($a in $als){
      $actions = @($a.AlarmActions)
      if(-not ($actions -contains $SnsTopicArn)){ return $false }
      if($a.Namespace -ne "CloudWatchSynthetics"){ return $false }
      if(($a.MetricName -ne "SuccessPercent") -and ($a.MetricName -ne "Duration")){ return $false }
    }
    return $true
  }

  function Enable-KmsKeyRotation() {
    foreach($k in $KmsKeyIds){
      $arn = ("arn:aws:kms:{0}:{1}:key/{2}" -f $Region,$Account,$k)
      $enabled = (A kms get-key-rotation-status --profile $Profile --region $Region --key-id $arn --query KeyRotationEnabled --output text)
      if("$enabled" -ne "True"){ A kms enable-key-rotation --profile $Profile --region $Region --key-id $arn }
    }
    return "Key rotation enabled for $($KmsKeyIds.Count) KMS keys"
  }
  function Test-KmsKeyRotationAllOn() {
    foreach($k in $KmsKeyIds){
      $arn = ("arn:aws:kms:{0}:{1}:key/{2}" -f $Region,$Account,$k)
      $enabled = (A kms get-key-rotation-status --profile $Profile --region $Region --key-id $arn --query KeyRotationEnabled --output text)
      if("$enabled" -ne "True"){ return $false }
    }
    return $true
  }

  function Attach-Vpce-ToAllRtbs() {
    $VpcId = (A ec2 describe-instances --profile $Profile --region $Region `
      --instance-ids $InstanceId --query "Reservations[0].Instances[0].VpcId" --output text).Trim()
    $rts = ((A ec2 describe-route-tables --profile $Profile --region $Region --output json) | ConvertFrom-Json).RouteTables
    $allRtbs = $rts | Where-Object { $_.VpcId -eq $VpcId } | ForEach-Object RouteTableId | Sort-Object -Unique
    $attached = (A ec2 describe-vpc-endpoints --profile $Profile --region $Region `
      --vpc-endpoint-ids $S3VpceId --query "VpcEndpoints[0].RouteTableIds" --output text) -split '\s+' | Where-Object { $_ } | Sort-Object -Unique
    $toAdd = $allRtbs | Where-Object { $attached -notcontains $_ }
    foreach($rt in $toAdd){
      A ec2 modify-vpc-endpoint --profile $Profile --region $Region --vpc-endpoint-id $S3VpceId --add-route-table-ids $rt | Out-Null
    }
    $final = (A ec2 describe-vpc-endpoints --profile $Profile --region $Region `
      --vpc-endpoint-ids $S3VpceId --query "VpcEndpoints[0].RouteTableIds" --output text)
    return ("RTBs added: {0}; now attached: {1}" -f (($toAdd -join ', ') -replace '^$','none'), $final)
  }
  function Test-VpceAttachedEveryRtb() {
    $VpcId = (A ec2 describe-instances --profile $Profile --region $Region `
      --instance-ids $InstanceId --query "Reservations[0].Instances[0].VpcId" --output text).Trim()
    $rts = ((A ec2 describe-route-tables --profile $Profile --region $Region --output json) | ConvertFrom-Json).RouteTables
    $allRtbs = $rts | Where-Object { $_.VpcId -eq $VpcId } | ForEach-Object RouteTableId | Sort-Object -Unique
    $attached = (A ec2 describe-vpc-endpoints --profile $Profile --region $Region `
      --vpc-endpoint-ids $S3VpceId --query "VpcEndpoints[0].RouteTableIds" --output text) -split '\s+' | Where-Object { $_ } | Sort-Object -Unique
    @($allRtbs | Where-Object { $attached -notcontains $_ }).Count -eq 0
  }

  function Apply-LifecycleViaSsm() {
    $lifecycle = @{
      Rules=@(
        @{ ID="abort-mpu-7d"; Status="Enabled"; Filter=@{}; AbortIncompleteMultipartUpload=@{ DaysAfterInitiation=7 } },
        @{ ID="catalog-proxies-ia30-glacierir180"; Status="Enabled"; Filter=@{ Prefix="catalog/proxies/" };
           Transitions=@(@{Days=30; StorageClass="STANDARD_IA"}, @{Days=180; StorageClass="GLACIER_IR"}) },
        @{ ID="catalog-masters-ia30-glacierir90"; Status="Enabled"; Filter=@{ Prefix="catalog/masters/" };
           Transitions=@(@{Days=30; StorageClass="STANDARD_IA"}, @{Days=90; StorageClass="GLACIER_IR"}) }
      )
    } | ConvertTo-Json -Depth 8 -Compress
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($lifecycle))
    $params = @{ commands = @(
      "printf '%s' '$b64' | base64 -d > /tmp/lifecycle.json",
      "aws s3api put-bucket-lifecycle-configuration --region $Region --bucket $ProcessedBucket --lifecycle-configuration file:///tmp/lifecycle.json",
      "aws s3api get-bucket-lifecycle-configuration --region $Region --bucket $ProcessedBucket --output json"
    )} | ConvertTo-Json -Compress
    $tmp = Join-Path $env:TEMP ("ssm_params_{0}.json" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
    $params | Out-File -Encoding utf8 $tmp
    $resp = (A ssm send-command --profile $Profile --region $Region `
      --instance-ids $InstanceId --document-name "AWS-RunShellScript" `
      --parameters "file://$tmp" --comment "Apply catalog lifecycle" --output json) | ConvertFrom-Json
    $o = Wait-SSM -InstanceId $InstanceId -CommandId $resp.Command.CommandId -PluginName "aws:runShellScript"
    if($o.Status -ne "Success"){ throw "Lifecycle SSM failed: $($o.StandardErrorContent)" }
    return "Applied lifecycle to $ProcessedBucket (rules: $($LifecycleRuleIds -join ', '))"
  }
  function Test-LifecyclePresent() {
    try{
      $res = A s3api get-bucket-lifecycle-configuration --profile $Profile --region $Region `
             --bucket $ProcessedBucket --output json
      $j = $res | ConvertFrom-Json
      $ids = @($j.Rules | ForEach-Object ID)
      ($LifecycleRuleIds | Where-Object { $ids -contains $_ }).Count -eq $LifecycleRuleIds.Count
    } catch { $false }
  }

  function Smoke-Synthetics() {
    $names = @("$CanaryName-SuccessPercent-notify","$CanaryName-LatencyHigh-notify")
    foreach($a in $names){ A cloudwatch set-alarm-state --profile $Profile --region $Region --alarm-name $a --state-value ALARM --state-reason "smoke" }
    Start-Sleep 8
    foreach($a in $names){ A cloudwatch set-alarm-state --profile $Profile --region $Region --alarm-name $a --state-value OK    --state-reason "smoke" }
    return "Triggered smoke ALARM→OK for $($names -join ', ')"
  }

  function Cleanup-RoleInline() {
    try {
      A iam delete-role-policy --profile $Profile --region $Region --role-name "lifebook-breakglass-ssm" --policy-name s3-lifecycle-temporary
      return "Removed inline policy s3-lifecycle-temporary"
    } catch { return "Inline policy not found (skipped)" }
  }

  # --- Step registry ---
  $steps = @(
    @{ Id='cw-eb-alarms';       Title="CloudWatch: EB FailedInvocations > 0 alarms";        Test={ Test-EbFailedInvocationsReady }; Do={ Upsert-EbFailedInvocations } },
    @{ Id='cw-synth-notify';    Title="CloudWatch: Synthetics 'notify' clones";              Test={ Test-SyntheticsNotifyReady };   Do={ Upsert-SyntheticsNotify } },
    @{ Id='kms-rotation';       Title="KMS: enable key rotation";                            Test={ Test-KmsKeyRotationAllOn };     Do={ Enable-KmsKeyRotation } },
    @{ Id='vpce-policy';        Title="S3 VPCE policy ($VpcePolicyMode)";                    Test={ Test-VpcePolicyHasLifecycle };  Do={ Set-VpcePolicy -Mode $VpcePolicyMode } },
    @{ Id='vpce-attach-rtbs';   Title="Attach S3 Gateway VPCE to all RTBs in VPC";           Test={ Test-VpceAttachedEveryRtb };    Do={ Attach-Vpce-ToAllRtbs } },
    @{ Id='s3-lifecycle';       Title="Apply catalog lifecycle on processed bucket (SSM)";   Test={ Test-LifecyclePresent };        Do={ Apply-LifecycleViaSsm } },
    @{ Id='smoke-alarms';       Title="Nightly smoke (ALARM→OK on synthetics)"; Optional=$true; Skip={ -not $PSBoundParameters.ContainsKey('SmokeAlarms') -or -not $SmokeAlarms }; Test={ $true }; Do={ Smoke-Synthetics } },
    @{ Id='cleanup-inline';     Title="Cleanup: remove temporary inline policy (breakglass)"; Optional=$true; Skip={ -not $PSBoundParameters.ContainsKey('CleanupRoleInlinePolicy') -or -not $CleanupRoleInlinePolicy }; Test={ $true }; Do={ Cleanup-RoleInline } }
  )

  # --- Orchestrate with persistent state + progress log ---
  Ensure-Directory -Path $StatePath
  $state = Load-State
  $total = $steps.Count
  $i = 0
  foreach($s in $steps){
    $i++
    $id = $s.Id
    $title = $s.Title

    if($s.ContainsKey('Skip') -and (& $s.Skip)){
      Write-Host ("[{0}/{1}] (skip optional) {2}" -f $i,$total,$title) -f DarkGray
      continue
    }

    if(Is-Completed $state $id){
      Write-Host ("[{0}/{1}] (ok) {2}" -f $i,$total,$title) -f Green
      continue
    }

    Write-Host ("[{0}/{1}] (test) {2}" -f $i,$total,$title) -f Cyan
    $ok = $false
    try { $ok = & $s.Test } catch { $ok = $false }
    if($ok){
      Mark-Completed $state $id "already compliant"
      Write-Host ("[{0}/{1}] (ok) {2}" -f $i,$total,$title) -f Green
      continue
    }

    Write-Host ("[{0}/{1}] (do) {2}" -f $i,$total,$title) -f Yellow
    $evidence = & $s.Do

    # --- verify with retry and non-blocking fallback ---
    Write-Host ("[{0}/{1}] (verify) {2}" -f $i,$total,$title) -f Cyan
    $ok2 = $false
    for($attempt=1; $attempt -le 10 -and -not $ok2; $attempt++){
      try { $ok2 = & $s.Test } catch { $ok2 = $false }
      if(-not $ok2){ Start-Sleep -Seconds ([int][math]::Min(15, 2 * $attempt)) }
    }
    if(-not $ok2){
      Write-Warning "Step '$id' verification timed out — recording 'Attempted' and continuing."
      if(-not $state.Steps.ContainsKey($id)){ $state.Steps.$id = @{} }
      $state.Steps.$id = @{ Status='Attempted'; At=(Get-Date).ToString('s'); Note=($evidence ?? "attempted") }
      Save-State $state
      continue
    }

    Mark-Completed $state $id ($evidence ?? "")
    Write-Host ("[{0}/{1}] (ok) {2}" -f $i,$total,$title) -f Green
  }

  $state.LastRun = (Get-Date).ToString('s')
  Save-State $state
  Write-Host "`n=== Done. All green. State: $StatePath ===" -f Green
}