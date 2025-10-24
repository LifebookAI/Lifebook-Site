#requires -Version 7
Set-StrictMode -Version Latest
Import-Module Progress
$root = $env:PROGRESS_ROOT
if (-not $root) {
  try { $r = git rev-parse --show-toplevel 2>$null; if ($LASTEXITCODE -eq 0 -and $r) { $root = $r.Trim() } } catch {}
  if (-not $root) { $root = (Get-Location).Path }
}
Test-ProgressSanity -LogDir (Join-Path $root 'logs')
