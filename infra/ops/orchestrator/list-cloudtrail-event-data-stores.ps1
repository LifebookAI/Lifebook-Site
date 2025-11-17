param(
    [Parameter()]
    [string]$Profile,

    [Parameter()]
    [string]$Region
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Aws {
    param(
        [Parameter(Mandatory, ValueFromRemainingArguments)]
        [string[]]$Cmd
    )
    $out = & aws @Cmd 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ("aws " + ($Cmd -join ' ') + " failed:`n" + $out)
    }
    try {
        $out | ConvertFrom-Json
    } catch {
        $out
    }
}

if (-not $Profile) {
    $Profile = $env:AWS_PROFILE
    if (-not $Profile) { $Profile = "lifebook-sso" }
}
if (-not $Region) {
    $Region = $env:AWS_REGION
    if (-not $Region) { $Region = "us-east-1" }
}

Write-Host "CloudTrail Lake Event Data Stores in $Region (profile $Profile)" -ForegroundColor Yellow
Write-Host ""

$eds = Invoke-Aws @("cloudtrail","list-event-data-stores",
    "--profile",$Profile,
    "--region",$Region)

$rows = @()
if ($eds.EventDataStores) {
    foreach ($s in $eds.EventDataStores) {
        $props = $s.PSObject.Properties.Name
        $rows += [pscustomobject]@{
            Name      = $(if ($props -contains "Name")              { $s.Name }              else { "<none>"    })
            Arn       = $(if     ($props -contains "EventDataStoreArn") { $s.EventDataStoreArn }
                         elseif ($props -contains "Arn")            { $s.Arn }               else { "<none>"    })
            Status    = $(if ($props -contains "Status")            { $s.Status }            else { "<unknown>" })
            Ingesting = $(if ($props -contains "IngestionEnabled")  { $s.IngestionEnabled }  else { "<unknown>" })
            Retention = $(if ($props -contains "RetentionPeriod")   { $s.RetentionPeriod }   else { "<unknown>" })
        }
    }
}

if ($rows.Count -eq 0) {
    Write-Host "No event data stores found." -ForegroundColor DarkYellow
} else {
    $rows | Sort-Object Name | Format-Table -AutoSize
}
