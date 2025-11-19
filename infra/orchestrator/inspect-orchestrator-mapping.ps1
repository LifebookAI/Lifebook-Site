param(
    [string]$Region  = $env:AWS_REGION,
    [string]$Profile = $env:AWS_PROFILE
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Region)  { $Region  = "us-east-1" }
if (-not $Profile) { $Profile = "lifebook-sso" }

$functionName = "lifebook-orchestrator-worker"

Write-Host ("Inspecting Lambda event source mappings for '{0}' (region={1}, profile={2})..." -f `
    $functionName, $Region, $Profile) -ForegroundColor Cyan

# List mappings for this function
try {
    $resp = aws lambda list-event-source-mappings `
        --function-name $functionName `
        --region $Region `
        --profile $Profile `
        --output json | ConvertFrom-Json
} catch {
    throw "aws lambda list-event-source-mappings failed: $($_.Exception.Message)"
}

$mappings = $resp.EventSourceMappings
if (-not $mappings) {
    Write-Host "No event source mappings found for $functionName." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nRaw mapping count: $($mappings.Count)" -ForegroundColor DarkCyan

# Show a concise table first
Write-Host "`nSummary table:" -ForegroundColor Green
$mappings | Select-Object `
    UUID,
    State,
    EventSourceArn,
    FunctionArn,
    BatchSize,
    MaximumBatchingWindowInSeconds |
    Format-Table -AutoSize

# Then show details + optional fields
foreach ($m in $mappings) {
    Write-Host "`n--- Mapping UUID: $($m.UUID) ---" -ForegroundColor Cyan
    Write-Host ("State                 : {0}" -f $m.State)
    Write-Host ("StateTransitionReason : {0}" -f $m.StateTransitionReason)

    # Optional: LastProcessingResult
    $hasLprProp = $m.PSObject.Properties.Name -contains 'LastProcessingResult'
    $lprValue   = if ($hasLprProp) { $m.LastProcessingResult } else { "<n/a>" }
    Write-Host ("LastProcessingResult  : {0}" -f $lprValue)

    Write-Host ("EventSourceArn        : {0}" -f $m.EventSourceArn)
    Write-Host ("BatchSize             : {0}" -f $m.BatchSize)
    Write-Host ("MaxBatchingWindowSecs : {0}" -f $m.MaximumBatchingWindowInSeconds)

    # Optional: FilterCriteria
    $hasFilterProp = $m.PSObject.Properties.Name -contains 'FilterCriteria'
    if ($hasFilterProp -and $m.FilterCriteria) {
        Write-Host "FilterCriteria (raw JSON):" -ForegroundColor DarkCyan
        $m.FilterCriteria | ConvertTo-Json -Depth 10
    } else {
        Write-Host "FilterCriteria         : (none)" -ForegroundColor DarkCyan
    }

    # Optional: MaximumRetryAttempts / MaximumRecordAgeInSeconds
    $hasRetryProp = $m.PSObject.Properties.Name -contains 'MaximumRetryAttempts'
    $hasAgeProp   = $m.PSObject.Properties.Name -contains 'MaximumRecordAgeInSeconds'

    if ($hasRetryProp -or $hasAgeProp) {
        $retryVal = if ($hasRetryProp) { $m.MaximumRetryAttempts } else { "<n/a>" }
        $ageVal   = if ($hasAgeProp)   { $m.MaximumRecordAgeInSeconds } else { "<n/a>" }
        Write-Host ("MaximumRetryAttempts   : {0}" -f $retryVal)
        Write-Host ("MaximumRecordAgeSecs   : {0}" -f $ageVal)
    } else {
        Write-Host "MaximumRetryAttempts   : <n/a>"
        Write-Host "MaximumRecordAgeSecs   : <n/a>"
    }
}
