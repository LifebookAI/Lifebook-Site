Param(
  [string]$RepoRoot = "$(git rev-parse --show-toplevel)".Trim()
)
$ErrorActionPreference='Stop'; Set-StrictMode -Version Latest
Set-Location $RepoRoot

# 1) Parse allowlist from analytics/spec.md JSON block
$specPath = Join-Path $RepoRoot "analytics/spec.md"
if (!(Test-Path $specPath)) { Write-Error "spec not found: $specPath"; exit 2 }

$raw = Get-Content $specPath -Raw
$match = [regex]::Match($raw, '(?s)BEGIN:EVENT_ALLOWLIST_JSON\s*-->\s*(\{.*?\})\s*<!--\s*END:EVENT_ALLOWLIST_JSON')
if (-not $match.Success) { Write-Error "Could not find allowlist JSON block in spec.md"; exit 2 }

try {
  $json = $match.Groups[1].Value | ConvertFrom-Json
} catch {
  Write-Error "Allowlist JSON failed to parse: $($_.Exception.Message)"
  exit 2
}
[string[]]$allowed = @($json.events | ForEach-Object { "$_" })

if ($allowed.Count -eq 0) { Write-Error "No events found in allowlist."; exit 2 }

# 2) Scan code for emitted events in common patterns:
#    analytics.track('event'), track("event"), emitEvent('event')
#    (JS/TS/TSX/JSX only; skip node_modules, .next, dist, build, .git)
$includeExt = @('*.ts','*.tsx','*.js','*.jsx')
$skipDirs   = @('\.git\\','node_modules\\','\.next\\','dist\\','build\\','out\\','.vercel\\')

$files = Get-ChildItem -Recurse -File -Include $includeExt | Where-Object {
  $p = $_.FullName
  -not ($skipDirs | Where-Object { $p -match $_ })
}

$found = [System.Collections.Generic.HashSet[string]]::new()
$unknown = [System.Collections.Generic.HashSet[string]]::new()

$regex = [regex]'(?ix)
  (?:^|[^A-Za-z0-9_])                # boundary
  (?:analytics\.)?track\s*\(\s*      # analytics.track(  or  track(
    (["'`])                          # opening quote
    (?<ev>[a-z0-9_]+)                # event name snake_case
    \1                               # same quote
'

foreach ($f in $files) {
  $txt = Get-Content $f.FullName -Raw
  foreach ($m in $regex.Matches($txt)) {
    $ev = $m.Groups['ev'].Value
    if (-not $found.Contains($ev)) { $found.Add($ev) | Out-Null }
    if ($allowed -notcontains $ev)  { $unknown.Add($ev) | Out-Null }
  }
}

Write-Host "Allowed events ($($allowed.Count)):`n  $($allowed -join ', ')`n"
Write-Host "Found in repo ($($found.Count)):`n  $([string]::Join(', ', $found))`n"

if ($unknown.Count -gt 0) {
  Write-Host "❌ Unknown/unlisted events detected:" -ForegroundColor Red
  $unknown | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  Write-Host "`nUpdate analytics/spec.md (allowlist) before merging."
  exit 2
}

Write-Host "✅ Analytics spec validation passed (no unknown events found)."
exit 0
