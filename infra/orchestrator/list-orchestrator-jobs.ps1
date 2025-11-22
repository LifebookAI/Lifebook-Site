# NORMAL (PS7) — List recent orchestrator jobs + per-job run-log counts
param(
    [int]$MaxJobs = 10,   # how many recent jobs to show
    [int]$MaxScan = 200   # upper bound on how many items to scan (safety)
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

$Region     = 'us-east-1'
$JobsTable  = 'lifebook-orchestrator-jobs'
$LogsTable  = 'lifebook-orchestrator-run-logs'

Write-Host "Using AWS profile '$Profile' in region '$Region'." -ForegroundColor Cyan
Write-Host "Jobs table : $JobsTable" -ForegroundColor DarkCyan
Write-Host "Run logs   : $LogsTable" -ForegroundColor DarkCyan
Write-Host ""

# -----------------------
# Helper: flatten DynamoDB JSON item (handles PSCustomObject via PSObject.Properties)
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
# Scan jobs table for JOB items
# -----------------------
Write-Host "=== Scan jobs table for sk = 'JOB' (up to $MaxScan items) ===" -ForegroundColor Yellow

$filterEav = @{ ':jobSk' = @{ S = 'JOB' } } | ConvertTo-Json -Compress

$jobsScanRaw = aws dynamodb scan `
    --table-name $JobsTable `
    --filter-expression "sk = :jobSk" `
    --expression-attribute-values $filterEav `
    --max-items $MaxScan `
    --profile $Profile `
    --region $Region `
    --output json

$jobsScan  = $jobsScanRaw | ConvertFrom-Json
$jobsItems = $jobsScan.Items

if (-not $jobsItems -or $jobsItems.Count -eq 0) {
    Write-Host "No JOB items found in '$JobsTable'." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Done." -ForegroundColor Green
    return
}

$jobsFlat = $jobsItems | ForEach-Object { Convert-DdbItem -Item $_ }

# Add a parsed DateTime to sort on; tolerate parse failures
foreach ($job in $jobsFlat) {
    $dt = $null
    if ($job.PSObject.Properties.Name -contains 'createdAt' -and $job.createdAt) {
        try {
            $dt = [DateTime]::Parse($job.createdAt)
        } catch {
            $dt = $null
        }
    }
    $job | Add-Member -NotePropertyName createdAtParsed -NotePropertyValue $dt -Force
}

$jobsSorted   = $jobsFlat | Sort-Object createdAtParsed -Descending
$jobsSelected = $jobsSorted | Select-Object -First $MaxJobs

Write-Host "Found $($jobsFlat.Count) JOB item(s); showing the $($jobsSelected.Count) most recent:" -ForegroundColor DarkYellow
Write-Host ""

# -----------------------
# For each job, query run logs and print a compact summary
# -----------------------
$index = 0
foreach ($job in $jobsSelected) {
    $index++

    $jobId = $job.jobId
    if (-not $jobId) {
        $jobId = $job.pk
    }

    $eavLogs = @{ ':jobId' = @{ S = $jobId } } | ConvertTo-Json -Compress

    $logsCount = 0
    try {
        $logsCountRaw = aws dynamodb query `
            --table-name $LogsTable `
            --key-condition-expression "jobId = :jobId" `
            --expression-attribute-values $eavLogs `
            --select "COUNT" `
            --profile $Profile `
            --region $Region `
            --output json

        $logsCountObj = $logsCountRaw | ConvertFrom-Json
        if ($logsCountObj -and $logsCountObj.PSObject.Properties.Name -contains 'Count') {
            $logsCount = [int]$logsCountObj.Count
        }
    } catch {
        Write-Host "Warning: failed to query run-log count for jobId '$jobId': $_" -ForegroundColor Yellow
    }

    Write-Host "=== Job #$index ===" -ForegroundColor DarkGray

    $summaryProps = [ordered]@{
        jobId        = $jobId
        status       = $job.status
        workflowSlug = $job.workflowSlug
        createdAt    = $job.createdAt
        updatedAt    = $job.updatedAt
        pk           = $job.pk
        sk           = $job.sk
        clientReqId  = $job.clientRequestId
        runLogCount  = $logsCount
    }

    [pscustomobject]$summaryProps | Format-List *
    Write-Host ""
}

Write-Host "Done." -ForegroundColor Green
