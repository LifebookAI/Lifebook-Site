param(
    [string]$Region  = $env:AWS_REGION,
    [string]$Profile = $env:AWS_PROFILE
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Region)  { $Region  = "us-east-1" }
if (-not $Profile) { $Profile = "lifebook-sso" }

Write-Host ("Using profile '{0}' in region '{1}' for orchestrator E2E latest checkpoint inspect..." -f $Profile, $Region) -ForegroundColor Cyan

# Resolve repo root
try {
    $repoRoot = (git rev-parse --show-toplevel).Trim()
} catch {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$cpFile = Join-Path $repoRoot "state/build-checkpoints.json"
if (-not (Test-Path $cpFile)) {
    throw "Checkpoint file not found at $cpFile"
}

$raw = Get-Content $cpFile -Raw
if (-not $raw.Trim()) {
    throw "Checkpoint file is empty."
}

$all = $raw | ConvertFrom-Json

# Treat single object or array uniformly
if (-not ($all -is [System.Collections.IEnumerable] -and -not ($all -is [string]))) {
    $all = @($all)
}

# Filter down to entries with area+step = orchestrator_e2e.synthetic_smoke
$withAreaStep = $all | Where-Object {
    $_.PSObject.Properties.Name -contains 'area' -and
    $_.PSObject.Properties.Name -contains 'step'
}

if (-not $withAreaStep -or $withAreaStep.Count -eq 0) {
    throw "No checkpoint entries with 'area' and 'step' found in $cpFile."
}

$latest = $withAreaStep |
    Where-Object { $_.area -eq 'orchestrator_e2e' -and $_.step -eq 'synthetic_smoke' } |
    Select-Object -Last 1

if (-not $latest) {
    throw "No orchestrator_e2e.synthetic_smoke checkpoint found."
}

Write-Host "`nLatest orchestrator_e2e.synthetic_smoke checkpoint:" -ForegroundColor Cyan
$latest | ConvertTo-Json -Depth 6

$bucket = $latest.details.s3_bucket
$key    = $latest.details.s3_key

if (-not $bucket -or -not $key) {
    Write-Host "`nCheckpoint has no s3_bucket/s3_key recorded; skipping S3 head." -ForegroundColor Yellow
    return
}

Write-Host ("`nHEAD s3://{0}/{1} ..." -f $bucket, $key) -ForegroundColor Cyan

try {
    $head = aws s3api head-object `
        --bucket $bucket `
        --key $key `
        --region $Region `
        --profile $Profile `
        --output json | ConvertFrom-Json
} catch {
    Write-Host "HEAD failed: $($_.Exception.Message)" -ForegroundColor Red
    return
}

$summary = [pscustomobject]@{
    Bucket           = $bucket
    Key              = $key
    ContentLength    = $head.ContentLength
    ContentType      = $head.ContentType
    LastModified     = $head.LastModified
    ServerSideEnc    = $head.ServerSideEncryption
    KmsKeyId         = $head.SSEKMSKeyId
    BucketKeyEnabled = $head.BucketKeyEnabled
}

Write-Host "`nS3 object summary:" -ForegroundColor Green
$summary | Format-List
