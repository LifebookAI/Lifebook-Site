param(
  [string[]]$Targets = @("services/orchestrator","infra/ingest"),
  [string]$ExpectedPattern = "^0\.25\.",
  [string]$ExpectedOverride = "^0\.25\.0$|^\^0\.25\.\d+$|^\^0\.25\.0$"
)
$ErrorActionPreference='Stop'; Set-StrictMode -Version Latest
$Repo = (git rev-parse --show-toplevel).Trim(); Set-Location $Repo

function Get-LockEsbuildVersions([string]$dir){
  $lockPath = Join-Path $dir 'package-lock.json'
  if(-not (Test-Path $lockPath)){ return @() }
  $lock = Get-Content $lockPath -Raw | ConvertFrom-Json -AsHashtable
  $out = New-Object System.Collections.Generic.List[string]
  if($lock.ContainsKey('packages') -and $lock['packages']){
    foreach($kv in $lock['packages'].GetEnumerator()){
      $key=[string]$kv.Key
      if($key -eq 'node_modules/esbuild' -or $key -like 'node_modules/@esbuild/*'){
        $ver=$kv.Value['version']; if($ver){ $out.Add([string]$ver) }
      }
    }
  }
  if($lock.ContainsKey('dependencies') -and $lock['dependencies']){
    if($lock['dependencies'].ContainsKey('esbuild')){
      $v=$lock['dependencies']['esbuild']; $ver = if($v -is [string]){ $v } else { $v['version'] }
      if($ver){ $out.Add([string]$ver) }
    }
  }
  return @($out | Sort-Object -Unique)
}

$rows = @()
foreach($rel in $Targets){
  $dir = Join-Path $Repo $rel
  if(-not (Test-Path (Join-Path $dir 'package.json'))) {
    $rows += [pscustomobject]@{dir=$rel; lock=@(); override='(no package.json)'; ok=$false}
    continue
  }
  $pkg = Get-Content (Join-Path $dir 'package.json') -Raw | ConvertFrom-Json
  $override = $pkg.PSObject.Properties['overrides']?.Value?.esbuild
  $locks = @(Get-LockEsbuildVersions $dir)

  $badLocks = @($locks | Where-Object { $_ -and ($_ -notmatch $ExpectedPattern) })
  $overrideBad = -not ($override -and ($override -match $ExpectedOverride))

  $ok = ($badLocks.Count -eq 0) -and (-not $overrideBad)
  $rows += [pscustomobject]@{
    dir       = $rel
    lockVers  = if($locks.Count){ ($locks -join ', ') } else { '(none)' }
    override  = $override ?? '(none)'
    ok        = $ok
  }
}

$rows | Format-Table -AutoSize
if(($rows | Where-Object { -not $_.ok } | Measure-Object).Count -gt 0){
  Write-Error "Esbuild pin guard failed — ensure all locks match $ExpectedPattern and overrides.esbuild is set (~ '^0.25.x')."
} else {
  Write-Host "[CI-GUARD OK] All targets pinned to 0.25.x with overrides." -ForegroundColor Green
}
