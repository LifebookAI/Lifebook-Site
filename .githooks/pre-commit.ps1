#requires -Version 7
Set-StrictMode -Version Latest
try { $root = git rev-parse --show-toplevel 2>$null; if ($LASTEXITCODE -eq 0 -and $root) { Set-Location $root.Trim() } } catch {}

# Gather staged paths (added/copied/modified)
$staged = git diff --name-only --cached --diff-filter=ACM 2>$null

$offenders = New-Object System.Collections.Generic.List[string]
foreach ($p in $staged) {
  if (-not $p) { continue }
  if ($p -match '\.(cmd|bat)$') { continue }               # allowed CRLF
  $attr = git check-attr eol -- "$p" 2>$null
  if ($attr -notmatch 'eol:\s*lf') { continue }            # only enforce where lf is required

  # Read working-tree bytes and look for CR (0x0D)
  try {
    $bytes = [System.IO.File]::ReadAllBytes($p)
    if ($bytes -contains 13) { [void]$offenders.Add($p) }
  } catch {
    # If file vanished or unreadable, let Git handle it later
  }
}

if ($offenders.Count -gt 0) {
  Write-Host "[pre-commit] CRLF found in staged files that require LF:" -ForegroundColor Red
  $offenders | ForEach-Object { " - $_" } | Out-Host
  Write-Host "`nFixes:" -ForegroundColor Yellow
  Write-Host "  * git add --renormalize ."
  Write-Host "  * Or: dos2unix <file>; git add <file>"
  Write-Host "  * Only *.cmd/*.bat are exempt (kept CRLF by policy)."
  exit 1
}

exit 0
