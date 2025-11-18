param(
    [string]$Region      = $env:AWS_REGION,
    [string]$Profile     = $env:AWS_PROFILE,
    [int]   $MaxMessages = 10
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Region)  { $Region  = "us-east-1" }
if (-not $Profile) { $Profile = "lifebook-sso" }

Write-Host ("Using profile '{0}' in region '{1}' for orchestrator DLQ inspect..." -f $Profile, $Region) -ForegroundColor Cyan

$accountId = "354630286254"
$dlqName   = "lifebook-orchestrator-queue-dlq"
$dlqUrl    = "https://sqs.$Region.amazonaws.com/$accountId/$dlqName"

Write-Host ("DLQ URL: {0}" -f $dlqUrl)

Write-Host ("`nReceiving up to {0} messages (no deletes, 10s visibility timeout)..." -f $MaxMessages) -ForegroundColor Cyan

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

$idx = 0
foreach ($m in $resp.Messages) {
    $idx++
    Write-Host ("`n--- DLQ Message #{0} ---" -f $idx) -ForegroundColor Green
    Write-Host ("MessageId: {0}" -f $m.MessageId)
    Write-Host ("ReceiptHandle (truncated): {0}" -f ($m.ReceiptHandle.Substring(0, [Math]::Min(40, $m.ReceiptHandle.Length))) )

    $bodyRaw = $m.Body
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

    if ($parsed) {
        # Try a couple of common shapes:
        # 1) Our orchestrator payload directly (jobId)
        # 1b) Scheduler-like payload (job_id, idempotency_key)
        # 2) Lambda DLQ envelope that wraps original as requestPayload.body
        $jobId   = $null
        $idemKey = $null
        $s3Key   = $null

        $propNames = $parsed.PSObject.Properties.Name

        # Case 1: direct orchestrator message (camelCase jobId)
        if (-not $jobId -and $propNames -contains 'jobId') {
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
            # These may not have outputs/s3Out at all; that's fine.
        }

        # Case 2: wrapped structure (e.g., requestPayload.body)
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
                        $jobId   = $innerBody.jobId
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

        if ($jobId -or $idemKey -or $s3Key) {
            [pscustomobject]@{
                jobId   = $jobId
                idemKey = $idemKey
                s3Key   = $s3Key
            } | Format-List
        } else {
            # Fallback: just dump the parsed object (briefly)
            $parsed | ConvertTo-Json -Depth 6
        }
    }

    Write-Host ( "`n(End of message #{0}; message NOT deleted and will reappear after visibility timeout.)" -f $idx ) -ForegroundColor DarkGray
}
