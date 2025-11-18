param(
    [string]$Region      = $env:AWS_REGION,
    [string]$Profile     = $env:AWS_PROFILE,
    [int]   $MaxMessages = 10,
    [switch]$ConfirmDrain
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Region)  { $Region  = "us-east-1" }
if (-not $Profile) { $Profile = "lifebook-sso" }

Write-Host ("Using profile '{0}' in region '{1}' for orchestrator DLQ drain..." -f $Profile, $Region) -ForegroundColor Cyan

$accountId = "354630286254"
$dlqName   = "lifebook-orchestrator-queue-dlq"
$dlqUrl    = "https://sqs.$Region.amazonaws.com/$accountId/$dlqName"

Write-Host ("DLQ URL: {0}" -f $dlqUrl)

Write-Host ("`nReceiving up to {0} messages (10s visibility timeout)..." -f $MaxMessages) -ForegroundColor Cyan

try {
    $resp = aws sqs receive-message `
        --queue-url $dlqUrl `
        --max-number-of-messages $MaxMessages `
        --visibility-timeout 10 `
        --wait-time-seconds 0 `
        --region $Region `
        --profile $Profile `
        --output json | ConvertFrom-Json
} catch {
    throw "aws sqs receive-message failed: $($_.Exception.Message)"
}

if (-not $resp.Messages) {
    Write-Host "No messages found in DLQ (or all currently invisible)." -ForegroundColor Green
    return
}

$candidates = @()
$idx = 0

foreach ($m in $resp.Messages) {
    $idx++
    $bodyRaw = $m.Body

    Write-Host ("`n--- DLQ Message #{0} ---" -f $idx) -ForegroundColor Green
    Write-Host ("MessageId: {0}" -f $m.MessageId)
    Write-Host ("ReceiptHandle (truncated): {0}" -f ($m.ReceiptHandle.Substring(0, [Math]::Min(40, $m.ReceiptHandle.Length))) )

    Write-Host "`nRaw Body (first 400 chars):" -ForegroundColor Cyan
    if ($bodyRaw.Length -gt 400) {
        $bodyRaw.Substring(0, 400) + "..."
    } else {
        $bodyRaw
    }

    Write-Host "`nParsed JSON (best-effort):" -ForegroundColor Cyan
    $parsed = $null
    try {
        $parsed = $bodyRaw | ConvertFrom-Json
    } catch {
        Write-Host "<Body is not valid JSON>" -ForegroundColor Yellow
    }

    $jobId        = $null
    $idemKey      = $null
    $s3Key        = $null
    $hasS3        = $false
    $hasDdbJob    = $false
    $deleteReason = $null

    if ($parsed) {
        $propNames = $parsed.PSObject.Properties.Name

        # Case 1: direct orchestrator/scheduler message (camelCase jobId/idemKey)
        if ($propNames -contains 'jobId') {
            $jobId   = $parsed.jobId
            if ($propNames -contains 'idemKey') {
                $idemKey = $parsed.idemKey
            }
            if ($parsed.outputs -and $parsed.outputs.s3Out) {
                $s3Key = $parsed.outputs.s3Out.key
            }
        }

        # Case 1b: scheduler-like message (snake_case job_id / idempotency_key)
        if (-not $jobId -and $propNames -contains 'job_id') {
            $jobId = $parsed.job_id
            if ($propNames -contains 'idempotency_key') {
                $idemKey = $parsed.idempotency_key
            }
        }

        # Optional: wrapped structure (e.g. requestPayload.body) — not strictly needed for the
        # scheduler shape we saw, but keeping for completeness.
        if (
            -not $jobId -and
            $propNames -contains 'requestPayload' -and
            $parsed.requestPayload
        ) {
            $inner      = $parsed.requestPayload
            $innerProps = $inner.PSObject.Properties.Name

            if ($innerProps -contains 'body' -and $inner.body) {
                try {
                    $innerBody      = $inner.body | ConvertFrom-Json
                    $innerBodyProps = $innerBody.PSObject.Properties.Name

                    if ($innerBodyProps -contains 'jobId') {
                        $jobId = $innerBody.jobId
                        if ($innerBodyProps -contains 'idemKey') {
                            $idemKey = $innerBody.idemKey
                        }
                        if ($innerBody.outputs -and $innerBody.outputs.s3Out) {
                            $s3Key = $innerBody.outputs.s3Out.key
                        }
                    } elseif ($innerBodyProps -contains 'job_id') {
                        $jobId = $innerBody.job_id
                        if ($innerBodyProps -contains 'idempotency_key') {
                            $idemKey = $innerBody.idempotency_key
                        }
                    }
                } catch { }
            }
        }

        # If we have a jobId and s3Key, do the same S3/DDB check as the inspector
        if ($jobId -and $s3Key) {
            $bucket = "lifebook.ai"
            Write-Host ("`nChecking S3 for s3://{0}/{1} ..." -f $bucket, $s3Key) -ForegroundColor Cyan
            try {
                aws s3api head-object `
                    --bucket $bucket `
                    --key $s3Key `
                    --region $Region `
                    --profile $Profile `
                    --output json | Out-Null
                $hasS3 = $true
                Write-Host "  S3 object EXISTS." -ForegroundColor Green
            } catch {
                Write-Host "  No S3 object found (HEAD failed)." -ForegroundColor Yellow
            }

            # DDB check against lifebook-orchestrator-jobs
            $table  = "lifebook-orchestrator-jobs"
            $keyObj = @{
                pk = @{ S = $jobId }
                sk = @{ S = "job" }
            }
            $keyJson = $keyObj | ConvertTo-Json -Depth 5

            try {
                $ddbResp = aws dynamodb get-item `
                    --table-name $table `
                    --key $keyJson `
                    --region $Region `
                    --profile $Profile `
                    --output json | ConvertFrom-Json
            } catch {
                Write-Host "  get-item failed: $($_.Exception.Message)" -ForegroundColor Yellow
                $ddbResp = $null
            }

            if ($ddbResp -and ($ddbResp.PSObject.Properties.Name -contains 'Item')) {
                $hasDdbJob = $true
                Write-Host "  DynamoDB job row EXISTS." -ForegroundColor Yellow
            } else {
                Write-Host "  No DynamoDB job row for this jobId." -ForegroundColor Yellow
            }

            # SAFETY RULE:
            # - Only mark as delete candidate if:
            #   * jobId starts with 'schedule-'
            #   * S3 artifact exists
            #   * there is NO DDB job row
            if ($jobId.StartsWith("schedule-") -and $hasS3 -and -not $hasDdbJob) {
                $deleteReason = "Synthetic scheduler message with S3 artifact but no DDB job row (safe to drain)."
            }
        }

        if ($jobId -or $idemKey -or $s3Key) {
            [pscustomobject]@{
                JobId          = $jobId
                IdemKey        = $idemKey
                S3Key          = $s3Key
                HasS3          = $hasS3
                HasDdbJob      = $hasDdbJob
                DeleteCandidate = [bool]($deleteReason)
                DeleteReason    = $deleteReason
            } | Format-List
        } else {
            # Fallback: just dump the parsed object briefly
            $parsed | ConvertTo-Json -Depth 6
        }
    }

    if ($deleteReason) {
        $candidates += [pscustomobject]@{
            MessageId      = $m.MessageId
            ReceiptHandle  = $m.ReceiptHandle
            JobId          = $jobId
            IdemKey        = $idemKey
            S3Key          = $s3Key
            DeleteReason   = $deleteReason
        }
    }

    Write-Host ( "`n(End of message #{0}; still in DLQ for now.)" -f $idx ) -ForegroundColor DarkGray
}

Write-Host "`nSummary of delete candidates (this run):" -ForegroundColor Green
if (-not $candidates -or $candidates.Count -eq 0) {
    Write-Host "  None matched the safe-to-delete criteria." -ForegroundColor Yellow
} else {
    $candidates | Select-Object MessageId, JobId, IdemKey, S3Key, DeleteReason | Format-Table -AutoSize
}

if (-not $ConfirmDrain) {
    Write-Host "`nDry-run only. Re-run with -ConfirmDrain to DELETE the candidates above." -ForegroundColor Yellow
    return
}

Write-Host "`n[DELETE] Proceeding to delete candidates from DLQ (because -ConfirmDrain was supplied)..." -ForegroundColor Red

foreach ($c in $candidates) {
    Write-Host ("Deleting MessageId={0}, JobId={1}" -f $c.MessageId, $c.JobId) -ForegroundColor Red
    try {
        aws sqs delete-message `
            --queue-url $dlqUrl `
            --receipt-handle $c.ReceiptHandle `
            --region $Region `
            --profile $Profile `
            --output json | Out-Null
        Write-Host "  Deleted." -ForegroundColor Green
    } catch {
        Write-Host ("  FAILED to delete: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
    }
}
