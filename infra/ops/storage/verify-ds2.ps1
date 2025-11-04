param(
  [string]$Profile,
  [string]$Region,
  [string]$Bucket = "lifebook.ai",
  [switch]$Json
)
$ErrorActionPreference = "Stop"; Set-StrictMode -Version Latest

# Resolve defaults safely
# --- CI-aware profile resolver ---
# Normalize empty -> $null
if ($Profile -is [string] -and [string]::IsNullOrWhiteSpace($Profile)) { $Profile = $null }
$IsCI = ($env:GITHUB_ACTIONS -eq 'true' -or $env:CI -eq 'true' -or -not [string]::IsNullOrWhiteSpace($env:AWS_ACCESS_KEY_ID))
# In CI (OIDC creds), do NOT use a named profile
if (-not $IsCI) {
  if (-not $Profile -and -not [string]::IsNullOrWhiteSpace($env:AWS_PROFILE)) { $Profile = $env:AWS_PROFILE }
  if (-not $Profile) { $Profile = 'lifebook-sso' }
}
# ---------------------------------
if (-not $Region)  { $Region  = $env:AWS_REGION }
if (-not $Region)  { $Region  = "us-east-1" }

function GetProp([object]$o,[string]$n){
  if($null -eq $o){ return $null }
  $p=$o.PSObject.Properties[$n]
  if($p){ return $p.Value }
  return $null
}
function Get-LcPrefix([object]$r){
  $f = GetProp $r 'Filter'
  if($f){
    $x = GetProp $f 'Prefix'
    if($x){ return $x }
  }
  return (GetProp $r 'Prefix')
}

# Build AWS CLI call with optional --profile
$cmd = @('s3api','get-bucket-lifecycle-configuration','--bucket', $Bucket,'--region',$Region)
if ($Profile -and -not [string]::IsNullOrWhiteSpace($Profile)) { $cmd += @('--profile', $Profile) }
$raw = aws @cmd | ConvertFrom-Json
$rules = @($raw.Rules)
if(-not $rules){ throw "No lifecycle rules returned for bucket '$Bucket' in region '$Region'." }

function Find-Rule($id,$prefix){
  foreach($r in $rules){
    $rid = GetProp $r 'ID'
    $pfx = Get-LcPrefix $r
    if( ($id -and $rid -match [regex]::Escape($id)) -or ($prefix -and $pfx -eq $prefix) ){
      return $r
    }
  }
  return $null
}

function Pick($r,[int]$ia,[int]$cold){
  $iaHit=$null; $coHit=$null
  foreach($t in @((GetProp $r 'Transitions'))){
    $sc = GetProp $t 'StorageClass'
    $d  = [int](GetProp $t 'Days')
    if($sc -in @('STANDARD_IA','ONEZONE_IA') -and [math]::Abs($d - $ia)   -le 1 -and -not $iaHit){ $iaHit=@{Days=$d;SC=$sc} }
    if($sc -in @('GLACIER_IR','GLACIER','DEEP_ARCHIVE') -and [math]::Abs($d - $cold) -le 1 -and -not $coHit){ $coHit=@{Days=$d;SC=$sc} }
  }
  return $iaHit,$coHit
}

$proxies = Find-Rule 'proxies' 'catalog/proxies/'
$masters = Find-Rule 'masters' 'catalog/masters/'
$abort   = $rules | Where-Object {
  $ai = GetProp $_ 'AbortIncompleteMultipartUpload'
  if($ai){ $d=[int](GetProp $ai 'DaysAfterInitiation'); ($d -ge 6 -and $d -le 8) }
}

$iaP,$coP = if($proxies){ Pick $proxies 30 180 } else { $null,$null }
$iaM,$coM = if($masters){ Pick $masters 30  90 } else { $null,$null }

$pass = ($proxies -and $iaP -and $coP) -and ($masters -and $iaM -and $coM) -and $abort

$out = [pscustomobject]@{
  Bucket   = $Bucket
  Region   = $Region
  Proxies  = if($proxies){ (GetProp $proxies 'ID') } else { '(missing)' }
  Masters  = if($masters){ (GetProp $masters 'ID') } else { '(missing)' }
  AbortMPU = if($abort){   (GetProp $abort   'ID') } else { '(missing)' }
  IA_P     = if($iaP){ "IA@$($iaP.Days)d" } else { '-' }
  COLD_P   = if($coP){ "$($coP.SC)@$($coP.Days)d" } else { '-' }
  IA_M     = if($iaM){ "IA@$($iaM.Days)d" } else { '-' }
  COLD_M   = if($coM){ "$($coM.SC)@$($coM.Days)d" } else { '-' }
  Pass     = $pass
}

if($Json){ $out | ConvertTo-Json -Depth 6; exit ([int](-not $pass)) }
$out | Format-Table -AutoSize
exit ([int](-not $pass))
