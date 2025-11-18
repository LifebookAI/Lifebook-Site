param(
    [string]$Region         = $env:AWS_REGION,
    [string]$Profile        = $env:AWS_PROFILE,
    [string]$AlertsTopicArn = "arn:aws:sns:us-east-1:354630286254:lifebook-alerts"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Region)  { $Region  = "us-east-1" }
if (-not $Profile) { $Profile = "lifebook-sso" }

Write-Host ("Using profile '{0}' in region '{1}' for orchestrator SQS CloudWatch alarms..." -f $Profile, $Region) -ForegroundColor Cyan

$AccountId = "354630286254"

# Define alarms: main queue visible, main queue age, DLQ visible
$alarms = @(
    @{
        Name       = "lifebook-orchestrator-queue-visible-messages-high"
        Metric     = "ApproximateNumberOfMessagesVisible"
        Queue      = "lifebook-orchestrator-queue"
        Threshold  = "5"         # >=5 visible messages
        Eval       = "5"         # over 5 x 60s
        Data       = "3"         # 3 of 5 to alarm
        Period     = "60"
        Stat       = "Average"
        Comparison = "GreaterThanOrEqualToThreshold"
        Note       = "Main orchestrator queue backlog"
    },
    @{
        Name       = "lifebook-orchestrator-queue-oldest-age-high"
        Metric     = "ApproximateAgeOfOldestMessage"
        Queue      = "lifebook-orchestrator-queue"
        Threshold  = "300"       # >= 5 minutes old
        Eval       = "1"
        Data       = "1"
        Period     = "60"
        Stat       = "Maximum"
        Comparison = "GreaterThanOrEqualToThreshold"
        Note       = "Main orchestrator queue stuck messages"
    },
    @{
        Name       = "lifebook-orchestrator-queue-dlq-visible-messages-high"
        Metric     = "ApproximateNumberOfMessagesVisible"
        Queue      = "lifebook-orchestrator-queue-dlq"
        Threshold  = "1"         # any message in DLQ
        Eval       = "1"
        Data       = "1"
        Period     = "60"
        Stat       = "Average"
        Comparison = "GreaterThanOrEqualToThreshold"
        Note       = "Orchestrator DLQ non-empty"
    }
)

foreach ($a in $alarms) {
    Write-Host ("`nUpserting alarm {0} ({1})..." -f $a.Name, $a.Note) -ForegroundColor Cyan

    $putArgs = @(
        'cloudwatch','put-metric-alarm',
        '--alarm-name', $a.Name,
        '--namespace','AWS/SQS',
        '--metric-name',$a.Metric,
        '--dimensions',"Name=QueueName,Value=$($a.Queue)",
        '--statistic',$a.Stat,
        '--period',$a.Period,
        '--evaluation-periods',$a.Eval,
        '--datapoints-to-alarm',$a.Data,
        '--threshold',$a.Threshold,
        '--comparison-operator',$a.Comparison,
        '--treat-missing-data','notBreaching',
        '--alarm-actions',$AlertsTopicArn,
        '--region',$Region,
        '--profile',$Profile
    )

    & aws @putArgs
    if ($LASTEXITCODE -ne 0) {
        throw "put-metric-alarm failed for $($a.Name) with exit code $LASTEXITCODE"
    }

    # NOTE: use ${Region} and ${AccountId} so PowerShell doesn't think "Region:" is part of the var name.
    $arn = "arn:aws:cloudwatch:${Region}:${AccountId}:alarm:$($a.Name)"
    Write-Host ("Tagging alarm {0}..." -f $arn) -ForegroundColor DarkCyan

    & aws cloudwatch tag-resource `
        --region $Region `
        --profile $Profile `
        --resource-arn $arn `
        --tags Key=Project,Value=lifebook Key=Env,Value=prod Key=Component,Value=orchestrator
    if ($LASTEXITCODE -ne 0) {
        throw "tag-resource failed for $($a.Name) with exit code $LASTEXITCODE"
    }
}

Write-Host "`nAll orchestrator SQS alarms created/updated and tagged successfully." -ForegroundColor Green
