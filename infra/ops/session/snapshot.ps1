param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Resolve repo root via git so we don't hardcode paths
$Repo = (git rev-parse --show-toplevel).Trim()
if (-not $Repo) {
    throw "Not inside a git repo; run this from within Lifebook-Site."
}

Set-Location $Repo

$CpFile = Join-Path $Repo "state/build-checkpoints.json"

if (-not (Test-Path $CpFile)) {
    "`n[WARN] No checkpoint file found at $CpFile" | Write-Host
    "[HINT] Run your checkpoint append script before snapshotting." | Write-Host
    return
}

# --- Git state ---
$branch = (& git branch --show-current).Trim()
$head   = (& git rev-parse HEAD).Trim()
$status = (& git status --short)

$dirtyText = if ([string]::IsNullOrWhiteSpace($status)) {
    "no (clean)"
} else {
    "YES — uncommitted changes present"
}

# --- Last checkpoint ---
$cpObj = $null
[string]$raw = Get-Content -Path $CpFile -Raw
if (-not [string]::IsNullOrWhiteSpace($raw)) {
    $all = $raw | ConvertFrom-Json
    if ($all -is [System.Collections.IEnumerable]) {
        $cpObj = $all[-1]
    } else {
        $cpObj = $all
    }
}

"`n[SNAPSHOT] Lifebook build state" | Write-Host
"Repo    : $Repo"      | Write-Host
"Branch  : $branch"    | Write-Host
"HEAD    : $head"      | Write-Host
"Dirty?  : $dirtyText" | Write-Host

if (-not $cpObj) {
    "`n[WARN] No checkpoint objects found in $CpFile" | Write-Host
    "[HINT] Run your checkpoint append script before snapshotting." | Write-Host
    return
}

"`nLast checkpoint:" | Write-Host
"  timestamp : {0}" -f $cpObj.timestamp | Write-Host
"  area      : {0}" -f $cpObj.area      | Write-Host
"  summary   : {0}" -f $cpObj.summary   | Write-Host

if ($cpObj.nextActions) {
    "  nextActions:" | Write-Host
    $cpObj.nextActions | ForEach-Object {
        "    - $_" | Write-Host
    }
}

# Build a ready-to-paste starter prompt for the next chat.
$nextText = if ($cpObj.nextActions -and $cpObj.nextActions.Count -gt 0) {
    $cpObj.nextActions -join '; '
} else {
    "pick the next open item from the Master Sheet."
}

$summaryTrim = ($cpObj.summary ?? "").Trim().TrimEnd(".")

"`n[Starter prompt for next chat]" | Write-Host
$starter = "Continue Lifebook build from checkpoint '{0}' in area '{1}'. We just {2}. Next, we should: {3}" -f `
    $cpObj.timestamp, $cpObj.area, $summaryTrim, $nextText
$starter | Write-Host
