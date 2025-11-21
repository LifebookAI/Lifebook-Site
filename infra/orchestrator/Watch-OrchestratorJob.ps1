<#
.SYNOPSIS
    Watch a single orchestrator job in DynamoDB until it reaches a final state.

.DESCRIPTION
    Polls the jobs table for a given JobId at a fixed interval until:
      - status == "completed" → returns (success)
      - status == "failed" or "timed_out" → throws
      - timeout elapses → marks the job as "timed_out" and throws

    Intended usage:
      - Call after creating an orchestrator job and obtaining its JobId.
      - Use in E2E smoke tests and operational tooling.

.NOTES
    - Requires AWS CLI v2 in PATH.
    - Respects AWS_PROFILE/AWS_REGION when not explicitly provided.
#>
function Watch-OrchestratorJob {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$JobId,

        [Parameter(Mandatory = $true)]
        [string]$JobsTableName,

        [int]$TimeoutSeconds = 120,
        [int]$PollIntervalSeconds = 5,

        [string]$Profile,
        [string]$Region
    )

    if (-not $Profile) {
        if ($env:AWS_PROFILE) {
            $Profile = $env:AWS_PROFILE
        }
        else {
            $Profile = 'lifebook-sso'
        }
    }

    if (-not $Region) {
        if ($env:AWS_REGION) {
            $Region = $env:AWS_REGION
        }
        else {
            $Region = 'us-east-1'
        }
    }

    if ($TimeoutSeconds -le 0) {
        throw "TimeoutSeconds must be > 0 (got $TimeoutSeconds)."
    }

    if ($PollIntervalSeconds -le 0) {
        throw "PollIntervalSeconds must be > 0 (got $PollIntervalSeconds)."
    }

    Write-Host ("[Watch-OrchestratorJob] JobId={0} Table={1} Profile={2} Region={3} Timeout={4}s Interval={5}s" -f `
        $JobId, $JobsTableName, $Profile, $Region, $TimeoutSeconds, $PollIntervalSeconds) -ForegroundColor Cyan

    $deadline   = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    $lastStatus = $null

    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        $keyJson = @{ jobId = @{ S = $JobId } } | ConvertTo-Json -Compress

        $json = aws dynamodb get-item `
            --profile $Profile `
            --region  $Region `
            --table-name $JobsTableName `
            --key $keyJson `
            --output json

        $doc = $json | ConvertFrom-Json

        if (-not $doc.Item) {
            Write-Warning "[Watch-OrchestratorJob] Job item not found yet for JobId=$JobId; sleeping..."
            Start-Sleep -Seconds $PollIntervalSeconds
            continue
        }

        $statusAttr = $doc.Item.status
        if (-not $statusAttr) {
            Write-Warning "[Watch-OrchestratorJob] Job item missing 'status' attribute; sleeping..."
            Start-Sleep -Seconds $PollIntervalSeconds
            continue
        }

        $status = $statusAttr.S

        if ($status -ne $lastStatus) {
            $lastStatus = $status
            $updatedAt  = if ($doc.Item.updatedAt) { $doc.Item.updatedAt.S } else { '<none>' }
            Write-Host ("[Watch-OrchestratorJob] [{0}] JobId={1} status={2}" -f $updatedAt, $JobId, $status) -ForegroundColor Yellow
        }

        switch ($status) {
            'completed' {
                Write-Host "[Watch-OrchestratorJob] Job $JobId completed successfully." -ForegroundColor Green
                return
            }
            'failed' {
                $msg = if ($doc.Item.errorMessage) { $doc.Item.errorMessage.S } else { '<none>' }
                throw "[Watch-OrchestratorJob] Job $JobId failed. errorMessage=$msg"
            }
            'timed_out' {
                throw "[Watch-OrchestratorJob] Job $JobId is already marked timed_out."
            }
            default {
                # queued or running; keep polling
                Start-Sleep -Seconds $PollIntervalSeconds
            }
        }
    }

    Write-Warning "[Watch-OrchestratorJob] Job $JobId did not reach a final state within ${TimeoutSeconds}s; marking as timed_out..."

    $now       = [DateTimeOffset]::UtcNow.ToString('o')
    $keyJson   = @{ jobId = @{ S = $JobId } } | ConvertTo-Json -Compress
    $namesJson = @{ '#s' = 'status' } | ConvertTo-Json -Compress
    $valuesJson = @{
        ':status'    = @{ S = 'timed_out' }
        ':updatedAt' = @{ S = $now }
    } | ConvertTo-Json -Compress

    aws dynamodb update-item `
        --profile $Profile `
        --region  $Region `
        --table-name $JobsTableName `
        --key $keyJson `
        --update-expression 'SET #s = :status, updatedAt = :updatedAt' `
        --expression-attribute-names $namesJson `
        --expression-attribute-values $valuesJson `
        | Out-Null

    throw "[Watch-OrchestratorJob] Job $JobId did not complete within ${TimeoutSeconds}s (last status='$lastStatus')."
}

<#
.EXAMPLE
    # Example usage after creating a job and obtaining its JobId in a smoke script:
    . "$PSScriptRoot\Watch-OrchestratorJob.ps1"

    $jobId       = '<inject-job-id-here>'
    $jobsTable   = 'lifebook-orchestrator-jobs'
    $timeoutSec  = 120
    $intervalSec = 5

    Watch-OrchestratorJob -JobId $jobId -JobsTableName $jobsTable -TimeoutSeconds $timeoutSec -PollIntervalSeconds $intervalSec
#>
