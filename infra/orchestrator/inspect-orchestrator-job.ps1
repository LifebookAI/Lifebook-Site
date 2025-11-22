# NORMAL (PS7) — Inspect orchestrator job E2E (DynamoDB job + run logs + S3 result.md)
param(
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

$Region     = 'us-east-1'
$JobsTable  = 'lifebook-orchestrator-jobs'
$LogsTable  = 'lifebook-orchestrator-run-logs'
$Bucket     = 'lifebook.ai'

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
# JobId input
# -----------------------
if (-not $JobId -or -not $JobId.Trim()) {
    $JobId = Read-Host "Enter jobId to inspect (e.g., 413f23f4b1218fad4804c180d2c04535)"
    if (-not $JobId -or -not $JobId.Trim()) {
        throw "jobId is required."
    }
}

Write-Host ""
Write-Host "Inspecting orchestrator job E2E for jobId '$JobId'..." -ForegroundColor Yellow
Write-Host ""

# -----------------------
# 1) Job record (pk=jobId, sk='JOB')
# -----------------------
Write-Host "=== Job record ===" -ForegroundColor Yellow

$keyJson = @{
    pk = @{ S = $JobId }
    sk = @{ S = 'JOB' }
} | ConvertTo-Json -Compress

$jobRaw = $null
try {
    $jobRaw = aws dynamodb get-item `
        --table-name $JobsTable `
        --key $keyJson `
        --profile $Profile `
        --region $Region `
        --output json
} catch {
    Write-Host "GetItem failed for jobs table '$JobsTable': $_" -ForegroundColor Red
}

if (-not $jobRaw) {
    Write-Host "No response from DynamoDB when fetching job." -ForegroundColor Red
} else {
    $jobObj = $jobRaw | ConvertFrom-Json

    if (-not $jobObj.Item) {
        Write-Host "No job found with pk='$JobId' and sk='JOB' in '$JobsTable'." -ForegroundColor Yellow
    } else {
        $jobFlat = Convert-DdbItem -Item $jobObj.Item

        Write-Host "--- Job item (flattened) ---" -ForegroundColor DarkGray
        $jobFlat | Format-List *

        Write-Host ""
        Write-Host "Compact summary:" -ForegroundColor DarkYellow

        $summaryProps = [ordered]@{
            pk           = $jobFlat.pk
            sk           = $jobFlat.sk
            jobId        = $jobFlat.jobId
            status       = $jobFlat.status
            workflowSlug = $jobFlat.workflowSlug
            clientReqId  = $jobFlat.clientRequestId
            createdAt    = $jobFlat.createdAt
            updatedAt    = $jobFlat.updatedAt
        }

        [pscustomobject]$summaryProps | Format-List *
    }
}

# -----------------------
# 2) Run logs for this jobId
# -----------------------
Write-Host ""
Write-Host "=== Run logs ===" -ForegroundColor Yellow

$eavLogs = @{ ':jobId' = @{ S = $JobId } } | ConvertTo-Json -Compress

$logsRaw = $null
try {
    $logsRaw = aws dynamodb query `
        --table-name $LogsTable `
        --key-condition-expression "jobId = :jobId" `
        --expression-attribute-values $eavLogs `
        --scan-index-forward `
        --profile $Profile `
        --region $Region `
        --output json
} catch {
    Write-Host "Query failed for run logs table '$LogsTable': $_" -ForegroundColor Red
}

if (-not $logsRaw) {
    Write-Host "No response from DynamoDB when querying run logs." -ForegroundColor Red
} else {
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
}

# -----------------------
# 3) S3 result.md (workflows/manual/<jobId>/result.md)
# -----------------------
Write-Host ""
Write-Host "=== S3 result.md ===" -ForegroundColor Yellow

$ResultKey = "workflows/manual/$JobId/result.md"
$OutFile   = Join-Path (Get-Location) ("job-{0}-result.md" -f $JobId)

Write-Host "Attempting to download s3://$Bucket/$ResultKey" -ForegroundColor DarkYellow

try {
    aws s3 cp "s3://$Bucket/$ResultKey" $OutFile `
        --profile $Profile `
        --region $Region | Out-Null

    Write-Host "Downloaded result to $OutFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "First few lines of result.md:" -ForegroundColor DarkYellow
    Get-Content $OutFile -TotalCount 20 | ForEach-Object { Write-Host $_ }
} catch {
    Write-Host "Could not download s3://$Bucket/$ResultKey — it may not exist for this jobId." -ForegroundColor Yellow
    Write-Host "Error: $_" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
