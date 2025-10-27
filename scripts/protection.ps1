param(
  [string]$Repo   = "LifebookAI/Lifebook-Site",
  [string]$Branch = "main",
  # The single status context we want to require
  [string]$RequiredContext = "CodeQL"
)

$ErrorActionPreference = "Stop"

function Set-RequiredChecks([string]$Context){
  @{ strict = $true; checks = @(@{ context = $Context }) } |
    ConvertTo-Json -Depth 10 |
    gh api --method PATCH -H "Accept: application/vnd.github+json" `
      "/repos/$Repo/branches/$Branch/protection/required_status_checks" --input -
}

function Set-Approvals([int]$Count){
  @{ required_approving_review_count = $Count } |
    ConvertTo-Json -Depth 10 |
    gh api --method PATCH -H "Accept: application/vnd.github+json" `
      "/repos/$Repo/branches/$Branch/protection/required_pull_request_reviews" --input -
}

function Set-ConversationResolution([bool]$Enabled){
  if($Enabled){
    gh api -X PUT -H "Accept: application/vnd.github+json" `
      "/repos/$Repo/branches/$Branch/protection/required_conversation_resolution" `
      2>$null | Out-Null
  } else {
    gh api -X DELETE -H "Accept: application/vnd.github+json" `
      "/repos/$Repo/branches/$Branch/protection/required_conversation_resolution" `
      2>$null | Out-Null
  }
}

function Set-Protection([int]$Approvals){
  # One-shot "golden" policy: strict checks ON, CodeQL required, convo ON, admins ON
  @{
    required_status_checks = @{
      strict = $true
      checks = @(@{ context = $RequiredContext })
    }
    enforce_admins = $true
    required_pull_request_reviews = @{
      required_approving_review_count = $Approvals
    }
    restrictions = $null
    required_linear_history = $false
    allow_force_pushes = $false
    allow_deletions = $false
    required_conversation_resolution = $true
  } | ConvertTo-Json -Depth 12 |
    gh api --method PUT -H "Accept: application/vnd.github+json" `
      "/repos/$Repo/branches/$Branch/protection" --input -
}

function Set-SoloMode {
  Set-Protection -Approvals 0 | Out-Null
  Write-Host "✅ Solo mode set: approvals=0, required check='$RequiredContext', strict+admins+convo ON"
}

function Set-TeamMode {
  Set-Protection -Approvals 1 | Out-Null
  Write-Host "✅ Team mode set: approvals=1, required check='$RequiredContext', strict+admins+convo ON"
}

function Show-Protection {
  $prot = gh api -H "Accept: application/vnd.github+json" "/repos/$Repo/branches/$Branch/protection" | ConvertFrom-Json
  $apr  = (gh api "/repos/$Repo/branches/$Branch/protection/required_pull_request_reviews" | ConvertFrom-Json).required_approving_review_count
  [pscustomobject]@{
    StrictStatusChecks = $prot.required_status_checks.strict
    RequiredChecks     = ($prot.required_status_checks.checks.context -join '; ')
    ApprovalsRequired  = $apr
    ConvoResolution    = $prot.required_conversation_resolution.enabled
    EnforceAdmins      = $prot.enforce_admins.enabled
  } | Format-List
}

# Export a couple convenience functions if dot-sourced
Set-Alias solo Set-SoloMode -Scope Local
Set-Alias team Set-TeamMode -Scope Local
Set-Alias protect Show-Protection -Scope Local

# Safe aliases (avoid built-in "sp")
Set-Alias setprot Set-Protection  -Scope Local
Set-Alias solo    Set-SoloMode    -Scope Local
Set-Alias team    Set-TeamMode    -Scope Local
Set-Alias protect Show-Protection -Scope Local
