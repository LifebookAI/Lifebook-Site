# NORMAL (PS7) — E2E smoke: latest orchestrator job has Dynamo job row, run logs, and S3 result.md
param(
    [int]$MaxScan = 200
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
$JobsTable = 'lifebook-orchestrator-jobs'
$LogsTable = 'lifebook-orchestrator-run-logs'
$Bucket    = 'lifebook.ai'

Write-Host "Using AWS profile '$Profile' in region '$Region'." -ForegroundColor Cyan
Write-Host "Jobs table : $JobsTable" -ForegroundColor DarkCyan
Write-Host "Run logs   : $LogsTable" -ForegroundColor DarkCyan
Write-Host "Result bucket: $Bucket" -ForegroundColor DarkCyan
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
# 1) Scan jobs table for latest JOB item
# -----------------------
Write-Host "Scanning '$JobsTable' for items with sk = 'JOB' (up to $MaxScan)..." -ForegroundColor Yellow

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
    Write-Host "ERROR: No JOB items found in '$JobsTable'." -ForegroundColor Red
    exit 1
}

$jobsFlat = $jobsItems | ForEach-Object { Convert-DdbItem -Item $_ }

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

$latestJob = $jobsFlat | Sort-Object createdAtParsed -Descending | Select-Object -First 1

if (-not $latestJob) {
    Write-Host "ERROR: Could not determine latest job." -ForegroundColor Red
    exit 1
}

$jobId = $latestJob.jobId
if (-not $jobId) {
    $jobId = $latestJob.pk
}

Write-Host ""
Write-Host "=== Latest orchestrator job ===" -ForegroundColor Yellow

[pscustomobject]([ordered]@{
    jobId        = $jobId
    status       = $latestJob.status
    workflowSlug = $latestJob.workflowSlug
    createdAt    = $latestJob.createdAt
    updatedAt    = $latestJob.updatedAt
    clientReqId  = $latestJob.clientRequestId
}) | Format-List *

# -----------------------
# 2) Run-log count for this job
# -----------------------
Write-Host ""
Write-Host "Checking run logs for jobId '$jobId'..." -ForegroundColor Yellow

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
    Write-Host "WARNING: Failed to query run-log count for jobId '$jobId': $_" -ForegroundColor Yellow
    $logsCount = -1
}

if ($logsCount -lt 0) {
    Write-Host "Run-log count unknown (query failed)." -ForegroundColor Yellow
} elseif ($logsCount -eq 0) {
    Write-Host "WARNING: No run logs found yet for this job." -ForegroundColor Yellow
} else {
    Write-Host "Run-log count: $logsCount" -ForegroundColor Green
}

# -----------------------
# 3) S3 result.md presence check
# -----------------------
Write-Host ""
Write-Host "Checking S3 result for jobId '$jobId'..." -ForegroundColor Yellow

$ResultKey = "workflows/manual/$jobId/result.md"
Write-Host "HEAD s3://$Bucket/$ResultKey" -ForegroundColor DarkYellow

$hasResult = $false
try {
    aws s3api head-object `
        --bucket $Bucket `
        --key $ResultKey `
        --profile $Profile `
        --region $Region `
        | Out-Null

    $hasResult = $true
} catch {
    Write-Host "ERROR: result.md not found (or head-object failed)." -ForegroundColor Red
    Write-Host "Detail: $_" -ForegroundColor DarkGray
    $hasResult = $false
}

if (-not $hasResult) {
    Write-Host ""
    Write-Host "Smoke FAILED: latest job has no S3 result.md at workflows/manual/<jobId>/result.md." -ForegroundColor Red
    exit 2
}

Write-Host ""
Write-Host "S3 result.md is present for jobId '$jobId'." -ForegroundColor Green

if ($logsCount -gt 0) {
    Write-Host "Smoke OK: latest job has Dynamo job row, at least one run log, and S3 result.md." -ForegroundColor Green
} else {
    Write-Host "Smoke OK (S3) but with WARNING: no run logs recorded for this job yet." -ForegroundColor Yellow
}

exit 0
