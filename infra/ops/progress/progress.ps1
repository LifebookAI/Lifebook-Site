#requires -Version 7
<#
Usage:
  pwsh infra/ops/progress/progress.ps1 work
  pwsh infra/ops/progress/progress.ps1 done -StepID "REP.31" -Status ✔ -Evidence "PR #31 merged" -Next "Run enforcer","Verify release/*"
  pwsh infra/ops/progress/progress.ps1 sync
  pwsh infra/ops/progress/progress.ps1 guard   # passes only if we recorded progress today; auto-syncs MD table if stale
#>

param(
  [Parameter(Mandatory=$true, Position=0)]
  [ValidateSet('work','done','sync','guard')]
  [string]$Cmd,

  [string]$StepID   = '',
  [ValidateSet('☐','⏳','✔','⛔')]
  [string]$Status   = '',
  [string]$Evidence = '',
  [string]$Decisions = '',
  [string]$Blockers  = '',
  [string[]]$Next    = @(),
  [string]$NextCsv   = '',
  [string]$Owner     = 'Zach',
  [string]$Target    = '',
  [string]$Phase     = '',
  [string]$StepTitle = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  $p = (git rev-parse --show-toplevel).Trim()
  if (-not $p) { throw "Not in a git repo. cd into repo and retry." }
  return $p
}

function Read-Json($path) {
  if (-not (Test-Path $path)) { return @() }
  $txt = Get-Content $path -Raw
  if (-not $txt) { return @() }
  return $txt | ConvertFrom-Json
}

function Write-LFFile($path, [string]$content) {
  $parent = Split-Path $path
  if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  $lf = $content -replace "`r?`n","`n"
  [IO.File]::WriteAllText($path, $lf, [Text.UTF8Encoding]::new($false))
}

function Save-Json($path, $obj) {
  $arr = @(); if ($null -ne $obj) { $arr = @($obj) }
  $json = $arr | ConvertTo-Json -Depth 12
  Write-LFFile -path $path -content $json
}

function Normalize-Date([string]$d) {
  if ([string]::IsNullOrWhiteSpace($d)) { return "" }
  try { return ([datetime]::Parse($d)).ToString('yyyy-MM-dd') } catch { return "" }
}

$root = Get-RepoRoot
$statePath = Join-Path $root 'logs/build-progress.json'
$mdPath    = Join-Path $root 'progress_block.md'

$script:state = @(Read-Json $statePath)
if (-not $script:state -or $script:state.Count -eq 0) { $script:state = @() }

function Upsert-Step([hashtable]$patch) {
  if (-not $patch.StepID) { throw "StepID required" }
  $existing = $script:state | Where-Object { $_.StepID -eq $patch.StepID } | Select-Object -First 1
  $now = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')

  if (-not $existing) {
    $item = [pscustomobject]@{
      Phase       = ($patch.Phase     ?? 'Phase 0 — Infra')
      StepID      = $patch.StepID
      StepTitle   = ($patch.StepTitle ?? '')
      Status      = ($patch.Status    ?? '⏳')
      Evidence    = ($patch.Evidence  ?? '')
      Decisions   = ($patch.Decisions ?? '')
      Blockers    = ($patch.Blockers  ?? '')
      Next        = @($patch.Next ?? @())
      Owner       = ($patch.Owner     ?? 'Zach')
      Target      = Normalize-Date ($patch.Target)
      LastUpdated = $now
      History     = @(@{ at=$now; patch=$patch })
    }
    $script:state = @($script:state) + $item
  } else {
    foreach ($k in @('Phase','StepTitle','Status','Evidence','Decisions','Blockers','Owner')) {
      if ($patch.ContainsKey($k) -and $patch[$k] -ne $null -and $patch[$k] -ne '') { $existing.$k = $patch[$k] }
    }
    if ($patch.ContainsKey('Next'))   { $existing.Next   = @($patch.Next | Where-Object { $_ -and $_.Trim() } | Select-Object -First 3) }
    if ($patch.ContainsKey('Target')) { $existing.Target = Normalize-Date ($patch.Target) }
    $existing.LastUpdated = $now
    $existing.History     = @(@($existing.History) + @{ at=$now; patch=$patch })
  }
}

function Export-MasterSheetBlock($items) {
  $rows = @()
  foreach ($i in $items) {
    $isOpen = $i.Status -ne '✔'
    $updatedToday = $false
    try { $updatedToday = (([datetime]$i.LastUpdated).ToLocalTime().Date -eq (Get-Date).Date) } catch { $updatedToday = $false }
    if ($isOpen -or $updatedToday) {
      $rows += [ordered]@{
        'Phase'  = $i.Phase
        'Step ID' = $i.StepID
        'Step Title' = $i.StepTitle
        'Status (☐/⏳/✔/⛔)' = $i.Status
        'Evidence (IDs/ARNs/links)' = ($i.Evidence ?? '') -replace "\r?\n",' '
        'Decisions' = ($i.Decisions ?? '') -replace "\r?\n",' '
        'Blockers'  = ($i.Blockers ?? '') -replace "\r?\n",' '
        'Next actions (max 3)' = (@($i.Next) -join ' | ')
        'Owner' = $i.Owner
        'Target (YYYY-MM-DD)' = $i.Target
      }
    }
  }

  if (-not $rows -or $rows.Count -eq 0) {
    $rows = @([ordered]@{
      'Phase'='—'
      'Step ID'='—'
      'Step Title'='No material progress'
      'Status (☐/⏳/✔/⛔)'='⏳'
      'Evidence (IDs/ARNs/links)'=''
      'Decisions'=''
      'Blockers'=''
      'Next actions (max 3)'=''
      'Owner'='Zach'
      'Target (YYYY-MM-DD)'=(Get-Date).ToString('yyyy-MM-dd')
    })
  }

  $headers = @('Phase','Step ID','Step Title','Status (☐/⏳/✔/⛔)','Evidence (IDs/ARNs/links)','Decisions','Blockers','Next actions (max 3)','Owner','Target (YYYY-MM-DD)')
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine(($headers -join ' | '))
  [void]$sb.AppendLine(($headers | ForEach-Object { '---' }) -join ' | ')
  foreach ($r in $rows) {
    $line = $headers | ForEach-Object {
      $val = ($r[$_] ?? '').ToString()
      if ($val.Length -gt 280) { $val = $val.Substring(0,277) + '…' }
      $val -replace '\|','\|'
    }
    [void]$sb.AppendLine(($line -join ' | '))
  }
  return $sb.ToString()
}

switch ($Cmd) {
'work' {
  $items = @($script:state) |
    Where-Object { $_ -is [psobject] } |
    Where-Object { $_.PSObject.Properties['StepID'] -and $_.PSObject.Properties['Status'] }

  if(-not $items){ Write-Host "No work items in logs/build-progress.json. Use 'done' to add, or 'sync' to export." ; break }

  $open = $items | Where-Object { $_.Status -ne "✔" } |
    Sort-Object @{e={ if($_.PSObject.Properties['Target'] -and $_.Target){ try{[datetime]$_.Target}catch{[datetime]::MaxValue} } else {[datetime]::MaxValue} }},
                @{e={$_.StepID}}

  if(-not $open){ Write-Host "No open items. All done 🎉" ; break }

  # Ensure UTF-8 output for em-dash
  try { [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false) } catch {}

  Write-Host "Open items (top 10):"
  $open | Select-Object -First 10 | ForEach-Object {
    $phase = if($_.PSObject.Properties['Phase'])     { $_.Phase } else { '—' }
    $title = if($_.PSObject.Properties['StepTitle']) { $_.StepTitle } else { '' }
    $tgt   = if($_.PSObject.Properties['Target'] -and $_.Target){ $_.Target } else { '—' }
    $nextA = if($_.PSObject.Properties['Next'] -and $_.Next){ (@($_.Next) | ForEach-Object { "$_" }) } else { @() }
    $next  = if($nextA.Count -gt 0){ $nextA -join '; ' } else { '—' }
    "{0} | {1} | {2} | target {3} | next: {4}" -f $phase, $_.StepID, $title, $tgt, $next
  } | Write-Host
  break
}

  'done' {
    if (-not $StepID) { throw "done: -StepID required" }
    if (-not $Status) { $Status = '✔' }
    if (-not $Next -and $NextCsv) { $Next = $NextCsv -split '\s*\|\s*' }

    $maybe     = $script:state | Where-Object { $_.StepID -eq $StepID } | Select-Object -First 1
    $phaseEff  = if ($Phase) { $Phase } elseif ($maybe) { $maybe.Phase } else { $null }
    $titleEff  = if ($StepTitle) { $StepTitle } elseif ($maybe) { $maybe.StepTitle } else { $null }

    $patch = @{
      StepID    = $StepID
      Phase     = $phaseEff
      StepTitle = $titleEff
      Status    = $Status
      Evidence  = $Evidence
      Decisions = $Decisions
      Blockers  = $Blockers
      Next      = $Next
      Owner     = $Owner
      Target    = $Target
    }
    Upsert-Step $patch

    Save-Json $statePath $script:state
    $md = Export-MasterSheetBlock $script:state
    Write-LFFile $mdPath $md

    Write-Host "Updated $StepID → $Status"
    Write-Host "Wrote:"
    Write-Host " - $statePath"
    Write-Host " - $mdPath (paste this table into Master Sheet)"
    break
  }

  'sync' {
    Save-Json $statePath $script:state
    $md = Export-MasterSheetBlock $script:state
    Write-LFFile $mdPath $md
    Write-Host "Synced:"
    Write-Host " - $statePath"
    Write-Host " - $mdPath"
    break
  }

  'guard' {
    # require at least one item updated today
    $today = (Get-Date).Date
    $touchedToday = $script:state | Where-Object {
      $ok = $false
      try { $ok = (([datetime]$_.LastUpdated).ToLocalTime().Date -eq $today) } catch { $ok = $false }
      $ok
    } | Select-Object -First 1

    if (-not $touchedToday) {
      Write-Error "No progress recorded today in logs/build-progress.json. Run 'done' before pushing."
      exit 1
    }

    # ensure the pasted table matches; if not, auto-sync it
    $mdExpected = Export-MasterSheetBlock $script:state
    $mdActual   = if (Test-Path $mdPath) { Get-Content $mdPath -Raw } else { '' }
    if ($mdExpected -ne $mdActual) {
      Write-Host "Guard: progress_block.md was out of date — auto-syncing..."
      Write-LFFile $mdPath $mdExpected
    }
    exit 0
  }
}