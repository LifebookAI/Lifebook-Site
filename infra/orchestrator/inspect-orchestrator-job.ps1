param(
    [Parameter(Mandatory = $true)]
    [string]$JobId,

    [string]$Region  = $env:AWS_REGION,
    [string]$Profile = $env:AWS_PROFILE
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Region)  { $Region  = "us-east-1" }
if (-not $Profile) { $Profile = "lifebook-sso" }

$tableName = "lifebook-orchestrator-jobs"

Write-Host ("Inspecting orchestrator job '{0}' in table '{1}' (region={2}, profile={3})..." -f $JobId, $tableName, $Region, $Profile) -ForegroundColor Cyan

# Build key (pk+sk)
$keyObj = @{
    pk = @{ S = $JobId }
    sk = @{ S = "job" }
}
$keyJson = $keyObj | ConvertTo-Json -Depth 5

try {
    $resp = aws dynamodb get-item `
        --table-name $tableName `
        --key $keyJson `
        --region $Region `
        --profile $Profile `
        --output json | ConvertFrom-Json
} catch {
    throw "aws dynamodb get-item failed: $($_.Exception.Message)"
}

if (-not $resp.Item) {
    Write-Error ("No job found with pk='{0}', sk='job' in table '{1}'." -f $JobId, $tableName)
    exit 1
}

$item = $resp.Item

function Get-AttrValue {
    param($Attr)
    if (-not $Attr) { return $null }
    if ($Attr.S)    { return $Attr.S }
    if ($Attr.N)    { return $Attr.N }
    if ($Attr.BOOL -ne $null) { return [bool]$Attr.BOOL }
    if ($Attr.NULL) { return $null }
    return $Attr
}

$summary = [pscustomobject]@{
    job_id          = (Get-AttrValue $item.job_id)
    status          = (Get-AttrValue $item.status)
    attempts        = if ($item.attempts)     { [int]$item.attempts.N }     else { $null }
    max_attempts    = if ($item.max_attempts) { [int]$item.max_attempts.N } else { $null }
    last_error_code = if ($item.last_error_code) {
                          if ($item.last_error_code.NULL) { $null } else { $item.last_error_code.S }
                      } else { $null }
    last_error_msg  = if ($item.last_error_message) {
                          if ($item.last_error_message.NULL) { $null } else { $item.last_error_message.S }
                      } else { $null }
    workspace_id    = (Get-AttrValue $item.workspace_id)
    workflow_id     = (Get-AttrValue $item.workflow_id)
    trigger_type    = (Get-AttrValue $item.trigger_type)
    created_at      = (Get-AttrValue $item.created_at)
    updated_at      = (Get-AttrValue $item.updated_at)
    started_at      = if ($item.started_at -and -not $item.started_at.NULL)   { $item.started_at.S }   else { $null }
    completed_at    = if ($item.completed_at -and -not $item.completed_at.NULL) { $item.completed_at.S } else { $null }
    ttl_at          = if ($item.ttl_at) { [int64]$item.ttl_at.N } else { $null }
}

Write-Host "`nOrchestrator job summary:" -ForegroundColor Green
$summary | Format-List
