[CmdletBinding()]
param(
  [switch]$Abort # force abort if still blocked
)
$ErrorActionPreference='Stop'; Set-StrictMode -Version Latest

# Ensure we're in a repo
$root = (git rev-parse --show-toplevel 2>$null).Trim()
if(-not $root){ throw "Run inside the Lifebook-Site repo." }
Set-Location $root

# Silence editors & clean stale swap (no pop-ups)
$env:GIT_EDITOR='true'; $env:GIT_SEQUENCE_EDITOR='true'
$swp = Join-Path $root '.git\.COMMIT_EDITMSG.swp'
if(Test-Path $swp){ Remove-Item $swp -Force }

$inRebase = (Test-Path '.git\rebase-merge') -or (Test-Path '.git\rebase-apply')

if($Abort){
  if($inRebase){ git rebase --abort | Out-Null; Write-Host "[rebase] aborted safely." -ForegroundColor Yellow }
  else{ Write-Host "[rebase] none in progress." -ForegroundColor DarkGray }
  return
}

if(-not $inRebase){
  Write-Host "[rebase] none in progress." -ForegroundColor DarkGray
  return
}

# Try to continue once; if it fails, abort
git add -A | Out-Null
& git rebase --continue
if($LASTEXITCODE -ne 0){
  Write-Host "[rebase] still blocked -> aborting safely." -ForegroundColor Yellow
  git rebase --abort | Out-Null
} else {
  Write-Host "[rebase] continued successfully." -ForegroundColor Green
}
