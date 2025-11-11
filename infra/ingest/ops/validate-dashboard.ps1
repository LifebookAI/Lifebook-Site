param(
  [string]$Profile = 'lifebook-sso',
  [string]$Region  = 'us-east-1',
  [string]$DashboardName = 'Lifebook-Ingest-Overview'
)
$ErrorActionPreference='Stop'; Set-StrictMode -Version Latest
aws sso login --profile $Profile | Out-Null
$env:AWS_PROFILE=$Profile; $env:AWS_REGION=$Region; $env:AWS_SDK_LOAD_CONFIG='1'

$gd   = aws cloudwatch get-dashboard --dashboard-name $DashboardName | ConvertFrom-Json
$body = $gd.DashboardBody | ConvertFrom-Json
$bad  = @()

# 1) ASCII hyphen-only titles (reject en/em dashes)
$dashBad = @($body.widgets | Where-Object {
  $t = $_.properties.title
  $t -and ($t -match '[\u2013\u2014]')
})
foreach($w in $dashBad){ $bad += "Non-ASCII dash in title: '$([string]$w.properties.title)'" }

# 2) metrics must be array-of-arrays (guard against missing 'metrics' under StrictMode)
foreach($w in $body.widgets){
  if(-not $w.properties){ continue }
  $metricsProp = $w.properties.PSObject.Properties['metrics']
  if(-not $metricsProp){ continue } # not a metric widget
  $m = $metricsProp.Value
  $outerOK = ($m -is [System.Collections.IEnumerable]) -and ($m -isnot [string])
  $first   = if($outerOK -and @($m).Count -gt 0){ @($m)[0] } else { $null }
  $innerOK = ($first -is [System.Collections.IEnumerable]) -and ($first -isnot [string])
  if(-not ($outerOK -and $innerOK)){
    $bad += "Non-AoA metrics on widget: '$([string]$w.properties.title)'"
  }
}

if($bad.Count){
  "Dashboard validation FAILED:`n - " + ($bad -join "`n - ") | Write-Error
  exit 2
}else{
  "Dashboard validation OK: AoA metrics + ASCII hyphens only."
}
