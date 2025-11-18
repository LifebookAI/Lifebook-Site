param(
    [string]$Region  = $env:AWS_REGION,
    [string]$Profile = $env:AWS_PROFILE
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Region)  { $Region  = "us-east-1" }
if (-not $Profile) { $Profile = "lifebook-sso" }

Write-Host ("Using profile '{0}' in region '{1}' for orchestrator queue health..." -f $Profile, $Region) -ForegroundColor Cyan

$accountId    = "354630286254"
$queueName    = "lifebook-orchestrator-queue"
$dlqName      = "lifebook-orchestrator-queue-dlq"

$queueUrl = "https://sqs.$Region.amazonaws.com/$accountId/$queueName"
$dlqUrl   = "https://sqs.$Region.amazonaws.com/$accountId/$dlqName"

function Get-QueueSummary {
    param(
        [string]$Name,
        [string]$Url
    )

    Write-Host ("`nQueue: {0}" -f $Name) -ForegroundColor Green
    Write-Host ("URL   : {0}" -f $Url)

    try {
        $attrs = aws sqs get-queue-attributes `
            --queue-url $Url `
            --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible ApproximateNumberOfMessagesDelayed `
            --region $Region `
            --profile $Profile `
            --output json | ConvertFrom-Json
    } catch {
        Write-Host "  FAILED to get attributes: $($_.Exception.Message)" -ForegroundColor Red
        return
    }

    $m        = $attrs.Attributes.ApproximateNumberOfMessages
    $notVis   = $attrs.Attributes.ApproximateNumberOfMessagesNotVisible
    $delayed  = $attrs.Attributes.ApproximateNumberOfMessagesDelayed

    $obj = [pscustomobject]@{
        ApproximateNumberOfMessages        = [int]$m
        ApproximateNumberOfMessagesNotVisible = [int]$notVis
        ApproximateNumberOfMessagesDelayed = [int]$delayed
    }

    $obj | Format-List
}

Get-QueueSummary -Name $queueName -Url $queueUrl
Get-QueueSummary -Name $dlqName   -Url $dlqUrl
