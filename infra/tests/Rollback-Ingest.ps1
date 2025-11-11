# ADMIN — detach S3 notif and disable Lambda (no delete)
param(
  [string]$Profile = "lifebook-sso",
  [string]$Region  = "us-east-1",
  [string]$Bucket  = "lifebook.ai",
  [string]$IngestFn = "lifebook-ingest"
)
Set-StrictMode -Version Latest; $ErrorActionPreference='Stop'

$notif = aws s3api get-bucket-notification-configuration --bucket $Bucket --profile $Profile --region $Region | ConvertFrom-Json
if($notif.LambdaFunctionConfigurations){
  $remain = @()
  foreach($c in $notif.LambdaFunctionConfigurations){
    if($c.Id -ne 'lifebook-ingest-sources'){ $remain += $c }
  }
  $new = @{
    LambdaFunctionConfigurations = $remain
    TopicConfigurations = $notif.TopicConfigurations
    QueueConfigurations = $notif.QueueConfigurations
  } | ConvertTo-Json -Depth 8
  aws s3api put-bucket-notification-configuration --bucket $Bucket --notification-configuration $new --profile $Profile --region $Region | Out-Null
  Write-Host "[ok] S3 notification removed."
}

aws lambda put-function-concurrency --function-name $IngestFn --reserved-concurrent-executions 0 --profile $Profile --region $Region | Out-Null
Write-Host "[ok] Lambda concurrency set to 0 (disabled)."