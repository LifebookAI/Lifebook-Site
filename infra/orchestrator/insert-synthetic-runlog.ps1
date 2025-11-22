# NORMAL (PS7) — Insert a synthetic run log for a jobId and read it back
param(
    [Parameter(Mandatory = $true)]
    [string]$JobId
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# -----------------------
# AWS context
# -----------------------
$Profile = $env:AWS_PROFILE
if (-not $Profile -or -not $Profile.Trim()) {
    $Profile = 'lifebook-sso'
}

$Region    = 'us-east-1'
$LogsTable = 'lifebook-orchestrator-run-logs'

Write-Host "Using AWS profile '$Profile' in region '$Region'." -ForegroundColor Cyan
Write-Host "Run logs table: $LogsTable" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "Target jobId: $JobId" -ForegroundColor DarkYellow
Write-Host ""

# -----------------------
# Helper: flatten DynamoDB JSON item
# -----------------------
function Convert-DdbItem {
    param(
        [Parameter(Mandatory = $true)]
        $Item
    )

    $result = [ordered]@{}

    foreach ($prop in $Item.PSObject.Properties) {
        $name = $prop.Name
        $val  = $prop.Value

        if ($null -eq $val) {
            $result[$name] = $null
            continue
        }

        if ($val.S) {
            $result[$name] = $val.S
        }
        elseif ($val.N) {
            if ($val.N -as [double] -ne $null) {
                $result[$name] = [double]$val.N
            } else {
                $result[$name] = $val.N
            }
        }
        elseif ($val.BOOL -ne $null) {
            $result[$name] = [bool]$val.BOOL
        }
        elseif ($val.M) {
            $result[$name] = Convert-DdbItem -Item $val.M
        }
        elseif ($val.L) {
            $list = @()
            foreach ($elem in $val.L) {
                $list += Convert-DdbItem -Item $elem
            }
            $result[$name] = $list
        }
        elseif ($val.SS) {
            $result[$name] = $val.SS
        }
        elseif ($val.NS) {
            $result[$name] = $val.NS
        }
        else {
            $result[$name] = $val
        }
    }

    [pscustomobject]$result
}

# -----------------------
# Build synthetic log item
# -----------------------
$now       = [DateTime]::UtcNow
$CreatedAt = $now.ToString("o")
$LogId     = [Guid]::NewGuid().ToString("N")

Write-Host "Creating synthetic run log item..." -ForegroundColor Yellow
Write-Host "  jobId     = $JobId" -ForegroundColor DarkYellow
Write-Host "  createdAt = $CreatedAt" -ForegroundColor DarkYellow
Write-Host "  logId     = $LogId" -ForegroundColor DarkYellow
Write-Host ""

$item = [ordered]@{
    jobId     = @{ S = $JobId }
    createdAt = @{ S = $CreatedAt }
    logId     = @{ S = $LogId }
    eventType = @{ S = 'debug_test_log' }
    message   = @{ S = 'Synthetic run log inserted via PowerShell (schema check)' }
    actor     = @{ S = 'manual-debug' }
}

$itemJson = $item | ConvertTo-Json -Compress

# -----------------------
# PutItem into run logs table
# -----------------------
aws dynamodb put-item `
    --table-name $LogsTable `
    --item $itemJson `
    --profile $Profile `
    --region $Region `
    | Out-Null

Write-Host "Synthetic run log written to '$LogsTable'." -ForegroundColor Green
Write-Host ""

# -----------------------
# Query logs back by jobId
# -----------------------
Write-Host "=== Run logs for jobId '$JobId' ===" -ForegroundColor Yellow

$eavLogs = @{ ':jobId' = @{ S = $JobId } } | ConvertTo-Json -Compress

$logsRaw = aws dynamodb query `
    --table-name $LogsTable `
    --key-condition-expression "jobId = :jobId" `
    --expression-attribute-values $eavLogs `
    --scan-index-forward `
    --profile $Profile `
    --region $Region `
    --output json

$logsObj  = $logsRaw | ConvertFrom-Json
$logItems = $logsObj.Items

if (-not $logItems -or $logItems.Count -eq 0) {
    Write-Host "No run logs found for jobId '$JobId' in '$LogsTable'." -ForegroundColor Yellow
} else {
    $logsFlat = $logItems | ForEach-Object { Convert-DdbItem -Item $_ }
    Write-Host "Found $($logsFlat.Count) run log item(s)." -ForegroundColor DarkYellow
    Write-Host ""

    foreach ($log in $logsFlat) {
        Write-Host "--- Log ---" -ForegroundColor DarkGray
        $log |
            Select-Object `
                jobId,
                createdAt,
                logId,
                eventType,
                message,
                actor `
            | Format-List *
    }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
