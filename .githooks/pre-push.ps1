#requires -Version 7
Set-StrictMode -Version Latest
$range = git rev-list --no-merges @{u}..HEAD 2>$null
$bad = @()
foreach ($sha in $range) {
  git verify-commit -v $sha *> $null
  if ($LASTEXITCODE -ne 0) { $bad += $sha }
}
if ($bad.Count) {
  Write-Host "[pre-push] Unsigned/Unverified commits:" -ForegroundColor Red
  $bad | ForEach-Object { " - $_" } | Out-Host
  exit 1
}
exit 0
