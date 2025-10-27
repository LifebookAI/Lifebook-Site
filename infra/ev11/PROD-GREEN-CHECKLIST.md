# Production Green — ev11

_Date:_ 2025-10-26 12:56:09 -04:00

## Environment

- **Account:** 354630286254

- **Region:**  us-east-1

## Key Outputs

- **SNS Topic:** arn:aws:sns:us-east-1:354630286254:lifebook-alerts

- **KMS Key:**   arn:aws:kms:us-east-1:354630286254:key/0586aab9-60ae-4931-b8dd-e0da232f6b1e

- **Smoke Lambda:** arn:aws:lambda:us-east-1:354630286254:function:lifebook-cw-alarm-smoke

## Policy / Config

- **KMS rotation:** ENABLED

- **EventBridge rule lifebook-cw-alarm-smoke-nightly:** ENABLED (cron(15 9 ** ? *))

## Discovered Resources

### CloudWatch Alarms (FailedInvocations)

- Lifebook-Events-lifebook-heartbeat-hourly-FailedInvocations-5m

- Lifebook-Heartbeat-Events-FailedInvocations

- lifebook-cf-health-forward-alarms-FailedInvocations

- lifebook-events-lifebook-ssm-rc-fail-FailedInvocations-5m-1of1

- lifebook-events-lifebook-ssm-sm-fail-FailedInvocations-5m-1of1

- lifebook-heartbeat-forward-alarms-FailedInvocations

- lifebook-ssm-rc-fail-FailedInvocations>0

- lifebook-ssm-sm-fail-FailedInvocations>0

### EventBridge Rules (lifebook*)

- arn:aws:events:us-east-1:354630286254:rule/lifebook-cf-health-forward-alarms

- arn:aws:events:us-east-1:354630286254:rule/lifebook-cw-alarm-smoke-nightly

- arn:aws:events:us-east-1:354630286254:rule/lifebook-cw-alarms-synthetic

- arn:aws:events:us-east-1:354630286254:rule/lifebook-heartbeat-forward-alarms

- arn:aws:events:us-east-1:354630286254:rule/lifebook-heartbeat-forward-test

- arn:aws:events:us-east-1:354630286254:rule/lifebook-heartbeat-hourly

- arn:aws:events:us-east-1:354630286254:rule/lifebook-heartbeat-schedule

- arn:aws:events:us-east-1:354630286254:rule/lifebook-kms-decrypt-errors

- arn:aws:events:us-east-1:354630286254:rule/lifebook-prod-heartbeat-hourly

- arn:aws:events:us-east-1:354630286254:rule/lifebook-s3-vpce-canary-fail

- arn:aws:events:us-east-1:354630286254:rule/lifebook-ssm-rc-fail

- arn:aws:events:us-east-1:354630286254:rule/lifebook-ssm-sm-fail

- arn:aws:events:us-east-1:354630286254:rule/lifebook-ssm-tap

- arn:aws:events:us-east-1:354630286254:rule/lifebook-ssm-tap-any

- arn:aws:events:us-east-1:354630286254:rule/lifebook-ssm-tap-rc

- arn:aws:events:us-east-1:354630286254:rule/lifebook-ssm-tap-sm

- arn:aws:events:us-east-1:354630286254:rule/lifebook-synthetic-hourly
