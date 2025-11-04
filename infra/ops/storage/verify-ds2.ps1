param(
  [string]$Profile,
  [string]$Region,
  [string]$Bucket = "lifebook.ai",
  [switch]$Json
)
$ErrorActionPreference = "Stop"; Set-StrictMode -Version Latest

# Resolve defaults safely
if (-not $Profile) { $Profile = $env:AWS_PROFILE }
if (-not $Profile) { $Profile = "lifebook-sso" }
if (-not $Region)  { $Region  = $env:AWS_REGION }
if (-not $Region)  { $Region  = "us-east-1" }

function GP([object]$o,[string]$n){ if($null -eq $o){ return $null }; $p=$o.PSObject.Properties[$n]; if($p){$p.Value} }
function Get-Prefix([object]$r){ $f=GP $r 'Filter'; if($f){ $x=GP $f 'Prefix'; if($x){return $x} }; return (GP $r 'Prefix') }

# Build AWS CLI call with optional --profile
$cmd = @('s3api','get-bucket-lifecycle-configuration','--bucket', $Bucket,'--region',$Region)
if ($Profile) { $cmd += @('--profile', $Profile) }
$raw   = aws @cmd | ConvertFrom-Json
$rules = @($raw.Rules)

function Find-Rule($id,$prefix){
  foreach($r in $rules){
    $rid = GP $r 'ID'; $pfx = Get-Prefix $r
    if( ($id -and $rid -match [regex]::Escape($id)) -or ($prefix -and $pfx -eq $prefix) ){ return $r }
  }; $null
}

function Pick($r,$ia,$cold){
  $iaHit=$null; $coHit=$null
  foreach($t in @((GP $r 'Transitions'))){
    $sc = GP $t 'StorageClass'; $d=[int](GP $t 'Days')
    if($sc -in @('STANDARD_IA','ONEZONE_IA') -and [math]::Abs($d - $ia)   -le 1 -and -not $iaHit){ $iaHit=@{Days=$d;SC=$sc} }
    if($sc -in @('GLACIER_IR','GLACIER','DEEP_ARCHIVE') -and [math]::Abs($d - $cold) -le 1 -and -not $coHit){ $coHit=@{Days=$d;SC=$sc} }
  }
  return $iaHit,$coHit
}

$proxies = Find-Rule 'proxies' 'catalog/proxies/'
$masters = Find-Rule 'masters' 'catalog/masters/'
$abort   = $rules | Where-Object { $ai=GP $_ 'AbortIncompleteMultipartUpload'; if($ai){ $d=[int](GP $ai 'DaysAfterInitiation'); ($d -ge 6 -and $d -le 8) } }

$iaP,$coP = if($proxies){ Pick $proxies 30 180 } else { $null,$null }
$iaM,$coM = if($masters){ Pick $masters 30  90 } else { $null,$null }

$pass = ($proxies -and $iaP -and $coP) -and ($masters -and $iaM -and $coM) -and $abort
$out = [pscustomobject]@{
  Bucket   = $Bucket
  Region   = $Region
  Proxies  = if($proxies){ (GP $proxies 'ID') } else { '(missing)' }
  Masters  = if($masters){ (GP $masters 'ID') } else { '(missing)' }
  AbortMPU = if($abort){ (GP $abort 'ID') } else { '(missing)' }
  IA_P     = if($iaP){ "IA@$($iaP.Days)d" } else { '-' }
  COLD_P   = if($coP){ "$($coP.SC)@$($coP.Days)d" } else { '-' }
  IA_M     = if($iaM){ "IA@$($iaM.Days)d" } else { '-' }
  COLD_M   = if($coM){ "$($coM.SC)@$($coM.Days)d" } else { '-' }
  Pass     = $pass
}

if($Json){ $out | ConvertTo-Json -Depth 6; exit ([int](-not $pass)) }
$out | Format-Table -AutoSize
exit ([int](-not $pass))
