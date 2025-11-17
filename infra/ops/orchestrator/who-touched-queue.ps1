param(
    [Parameter()]
    [int]$MinutesBack = 30,

    [Parameter()]
    [string]$Profile,

    [Parameter()]
    [string]$Region,

    [Parameter()]
    [string]$QueueName = 'lifebook-orchestrator-queue',

    [Parameter()]
    [string]$QueueUrl,

    [Parameter()]
    [string]$EventDataStoreId,

    [Parameter()]
    [switch]$Raw,

    [Parameter()]
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Aws {
    param(
        [Parameter(Mandatory, ValueFromRemainingArguments)]
        [string[]]$Cmd
    )
    $out = & aws @Cmd 2>&1
    if ($LASTEXITCODE -ne 0) {
        # Special-case CloudTrail Lake inactive EDS so ops can see the real issue.
        if ($out -match 'InactiveEventDataStoreException') {
            throw ("CloudTrail Lake event data store is INACTIVE. " +
                   "Enable ingestion or create a new active event data store for SQS data events, " +
                   "then re-run who-touched-queue.ps1.`nRaw error:`n" + $out)
        }
        throw ("aws " + ($Cmd -join ' ') + " failed:`n" + $out)
    }
    try {
        $out | ConvertFrom-Json
    } catch {
        $out
    }
}

# ---- Resolve profile & region ----
if (-not $Profile) {
    $Profile = $env:AWS_PROFILE
    if (-not $Profile) { $Profile = 'lifebook-sso' }
}
if (-not $Region) {
    $Region = $env:AWS_REGION
    if (-not $Region) { $Region = 'us-east-1' }
}

# ---- Resolve repo root (best-effort) & log directory ----
$Repo = $null
try {
    $Repo = (git rev-parse --show-toplevel 2>$null).Trim()
} catch {
    $Repo = $null
}

if ($Repo) {
    $LogRoot = Join-Path $Repo 'logs/orchestrator'
} else {
    $LogRoot = Join-Path (Get-Location) 'logs/orchestrator'
}
New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null

# ---- Resolve SQS queue URL if not provided ----
if (-not $QueueUrl) {
    $q = Invoke-Aws @('sqs', 'get-queue-url',
        '--queue-name', $QueueName,
        '--profile', $Profile,
        '--region',  $Region)

    if (-not $q.QueueUrl) {
        throw "Could not resolve QueueUrl for name '$QueueName' in $Region."
    }
    $QueueUrl = $q.QueueUrl
}

# ---- Resolve CloudTrail Lake Event Data Store ID if not provided ----
if (-not $EventDataStoreId) {
    $eds = Invoke-Aws @('cloudtrail', 'list-event-data-stores',
        '--profile', $Profile,
        '--region',  $Region)

    # Normalize to an array
    $storesRaw = @()
    if ($eds.EventDataStores) {
        $storesRaw = @($eds.EventDataStores)
    }

    if ($storesRaw.Count -eq 0) {
        throw "No CloudTrail Lake event data stores found in $Region."
    }

    # Try to pick only ENABLED + ingesting stores when those properties exist.
    $candidates = @()
    foreach ($store in $storesRaw) {
        $props        = $store.PSObject.Properties.Name
        $hasStatus    = $props -contains 'Status'
        $hasIngesting = $props -contains 'IngestionEnabled'

        if ($hasStatus -and $hasIngesting) {
            if ($store.Status -eq 'ENABLED' -and $store.IngestionEnabled) {
                $candidates += $store
            }
        } elseif ($hasStatus) {
            if ($store.Status -eq 'ENABLED') {
                $candidates += $store
            }
        } else {
            # Unknown schema; accept as candidate rather than failing.
            $candidates += $store
        }
    }

    if ($candidates.Count -eq 0) {
        # Fall back to "any store" if our filtering produced nothing.
        $candidates = $storesRaw
    }

    # Prefer the dedicated orchestrator EDS by name, if present.
    $chosen = $candidates | Where-Object {
        ($_ | Get-Member -Name Name -ErrorAction SilentlyContinue) -and
        ($_.Name -eq 'lifebook-sqs-orchestrator-audit')
    } | Select-Object -First 1

    # If not found, prefer any 'lifebook' store.
    if (-not $chosen) {
        $chosen = $candidates | Where-Object {
            ($_ | Get-Member -Name Name -ErrorAction SilentlyContinue) -and
            ($_.Name -like '*lifebook*')
        } | Select-Object -First 1
    }

    # Final fallback: first candidate.
    if (-not $chosen) {
        $chosen = $candidates | Select-Object -First 1
    }

    # Extract ARN and ID suffix
    $arn = $null
    $propsChosen = $chosen.PSObject.Properties.Name
    if ($propsChosen -contains 'EventDataStoreArn') {
        $arn = $chosen.EventDataStoreArn
    } elseif ($propsChosen -contains 'Arn') {
        $arn = $chosen.Arn
    } else {
        throw "Selected CloudTrail event data store did not expose an ARN property; cannot derive ID."
    }

    $EventDataStoreId = ($arn -split '/')[ -1 ]

    if (-not $Quiet) {
        Write-Host "Using CloudTrail Lake event data store:" -ForegroundColor Cyan
        if ($propsChosen -contains 'Name') {
            Write-Host "  Name : $($chosen.Name)" -ForegroundColor Cyan
        }
        Write-Host "  ARN  : $arn" -ForegroundColor Cyan
        Write-Host "  ID   : $EventDataStoreId" -ForegroundColor Cyan
        Write-Host ""
    }
}

# ---- Time window (UTC) ----
$now      = Get-Date
$start    = $now.AddMinutes(-1 * $MinutesBack)
$startUtc = $start.ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss')
$endUtc   = $now.ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss')

if (-not $Quiet) {
    Write-Host "CloudTrail Lake SQS probe for queue:" -ForegroundColor Yellow
    Write-Host "  QueueUrl : $QueueUrl" -ForegroundColor Yellow
    Write-Host "  Minutes  : $MinutesBack" -ForegroundColor Yellow
    Write-Host "  Window   : $startUtc to $endUtc (UTC)" -ForegroundColor Yellow
    Write-Host ""
}

# ---- SQL query ----
$query = @"
SELECT
  eventTime,
  eventName,
  substr(userIdentity.arn, strpos(userIdentity.arn, '/') + 1) AS iamPrincipal,
  sourceIPAddress,
  vpcEndpointId,
  element_at(requestParameters, 'queueUrl') AS queueUrl
FROM $EventDataStoreId
WHERE eventSource = 'sqs.amazonaws.com'
  AND element_at(requestParameters, 'queueUrl') = '$QueueUrl'
  AND eventtime >= '$startUtc'
  AND eventtime <= '$endUtc'
ORDER BY eventTime DESC
LIMIT 500
"@

if (-not $Quiet) {
    Write-Host "Starting CloudTrail Lake query..." -ForegroundColor Green
}

$startResp = Invoke-Aws @(
    'cloudtrail', 'start-query',
    '--query-statement', $query,
    '--profile', $Profile,
    '--region',  $Region
)
$queryId = $startResp.QueryId
if (-not $queryId) {
    throw "cloudtrail start-query did not return a QueryId."
}

# ---- Poll for completion ----
$maxPollSeconds = 60
$delaySeconds   = 3
$elapsed        = 0
$status         = 'RUNNING'

while ($elapsed -lt $maxPollSeconds) {
    Start-Sleep -Seconds $delaySeconds
    $elapsed += $delaySeconds

    $desc   = Invoke-Aws @(
        'cloudtrail', 'describe-query',
        '--query-id', $queryId,
        '--profile',  $Profile,
        '--region',   $Region
    )
    $status = $desc.QueryStatus

    if ($status -in @('FINISHED', 'FAILED', 'CANCELLED', 'TIMED_OUT')) {
        break
    }
}

if ($status -ne 'FINISHED') {
    throw "CloudTrail Lake query $queryId did not finish successfully (status = $status)."
}

$res = Invoke-Aws @(
    'cloudtrail', 'get-query-results',
    '--query-id', $queryId,
    '--profile',  $Profile,
    '--region',   $Region
)

# ---- Normalize QueryResultRows / QueryResults into a single $records array ----
$records = @()
$rowsPropName = $null
$propsRes = $res.PSObject.Properties.Name

if ($propsRes -contains 'QueryResultRows') {
    $rowsPropName = 'QueryResultRows'
} elseif ($propsRes -contains 'QueryResults') {
    $rowsPropName = 'QueryResults'
}

$rawRows = @()
if ($rowsPropName) {
    $rawRows = @($res.$rowsPropName)
}

if ($rawRows.Count -gt 0) {
    foreach ($row in $rawRows) {
        if (-not $row) { continue }

        # Ensure we can enumerate the "cells" in this row
        $rowEnumerable = $row
        if ($row -isnot [System.Collections.IEnumerable] -or $row -is [string]) {
            $rowEnumerable = @($row)
        }

        $obj = [ordered]@{}

        foreach ($cell in $rowEnumerable) {
            if (-not $cell) { continue }

            $cellProps = $cell.PSObject.Properties.Name

            # Old schema: each cell has Field/Value or field/value
            if ($cellProps -contains 'Field' -and $cellProps -contains 'Value') {
                $key   = $cell.Field
                $value = $cell.Value
                if ($key) { $obj[$key] = $value }
            } elseif ($cellProps -contains 'field' -and $cellProps -contains 'value') {
                $key   = $cell.field
                $value = $cell.value
                if ($key) { $obj[$key] = $value }
            } else {
                # New schema: the cell itself is a map of columnName -> value
                foreach ($prop in $cell.PSObject.Properties) {
                    $obj[$prop.Name] = $prop.Value
                }
            }
        }

        if ($obj.Count -gt 0) {
            $records += [pscustomobject]$obj
        }
    }
}

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$logFile   = Join-Path $LogRoot ("who-touched-queue_{0}.json" -f $timestamp)
$latest    = Join-Path $LogRoot 'who-touched-queue_latest.json'

$payload = [pscustomobject]@{
    QueueUrl        = $QueueUrl
    EventDataStore  = $EventDataStoreId
    WindowStartUtc  = $startUtc
    WindowEndUtc    = $endUtc
    QueryId         = $queryId
    QueryStatus     = $status
    ResultCount     = $records.Count
    Records         = $records
}

$payload | ConvertTo-Json -Depth 6 | Out-File -Encoding utf8NoBOM -FilePath $logFile
Copy-Item -Force $logFile $latest

if ($Raw) {
    # Emit JSON for callers (e.g. verifier scripts)
    $payload | ConvertTo-Json -Depth 6
} else {
    if (-not $Quiet) {
        Write-Host ""
        Write-Host "Results (most recent first):" -ForegroundColor Cyan
    }

    if ($records.Count -eq 0) {
        Write-Host "No SQS data events found for this queue in the selected window." -ForegroundColor DarkYellow
    } else {
        $records |
            Select-Object eventTime, eventName, iamPrincipal, sourceIPAddress, vpcEndpointId |
            Format-Table -AutoSize

        if (-not $Quiet) {
            Write-Host ""
            Write-Host "Saved full results to:" -ForegroundColor Cyan
            Write-Host "  $logFile" -ForegroundColor Cyan
            Write-Host "  $latest"  -ForegroundColor Cyan
        }
    }
}
