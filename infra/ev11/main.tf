# ---------- KMS KEY + ALIAS ----------
resource "aws_kms_key" "lifebook_synthetics" {
  description         = "Lifebook CMK for SNS lifebook-alerts and related"
  enable_key_rotation = true
  policy              = data.aws_iam_policy_document.kms.json
  tags                = var.tags
}

resource "aws_kms_alias" "lifebook_synthetics" {
  name          = "alias/lifebook-synthetics"
  target_key_id = aws_kms_key.lifebook_synthetics.key_id
}

# ---------- SNS TOPIC + POLICY ----------
resource "aws_sns_topic" "alerts" {
  name              = local.alerts_topic_name
  kms_master_key_id = aws_kms_key.lifebook_synthetics.arn
  tags              = var.tags
}
/*

data "aws_iam_policy_document" "sns" {
  # EventBridge rules allowed to publish
  statement {
    sid       = "AllowEventBridge"
    effect    = "Allow"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.alerts.arn]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = var.eventbridge_rule_arns
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.account_id]
    }
  }

  # CloudWatch Alarms allowed to publish
  statement {
    sid       = "AllowCloudWatchAlarms"
    effect    = "Allow"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.alerts.arn]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = var.cloudwatch_alarm_arns
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.account_id]
    }
  }
}
*/
/*

resource "aws_sns_topic_policy" "alerts" {
  arn    = aws_sns_topic.alerts.arn
  policy = data.aws_iam_policy_document.sns.json
}
*/

# ---------- SMOKE LAMBDA + SCHEDULE ----------
data "aws_iam_policy_document" "smoke_trust" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "smoke" {
  name               = "lifebook-cw-alarm-smoke-role"
  assume_role_policy = data.aws_iam_policy_document.smoke_trust.json
  tags               = var.tags
}

data "aws_iam_policy_document" "smoke_inline" {
  statement {
    sid       = "Logs"
    effect    = "Allow"
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${var.region}:${var.account_id}:*"]
  }

  statement {
    sid       = "SetAlarmState"
    effect    = "Allow"
    actions   = ["cloudwatch:SetAlarmState"]
    resources = var.cloudwatch_alarm_arns
  }
}

resource "aws_iam_role_policy" "smoke_inline" {
  name   = "lifebook-cw-alarm-smoke-inline"
  role   = aws_iam_role.smoke.id
  policy = data.aws_iam_policy_document.smoke_inline.json
}

data "archive_file" "smoke_zip" {
  type        = "zip"
  output_path = "${path.module}/smoke.zip"
  source {
    filename = "index.py"
    content  = <<PY
import os, time, boto3
cw = boto3.client("cloudwatch")
ALARM_NAMES = [a for a in os.environ.get("ALARM_NAMES","").split(",") if a]
SLEEP_SECS = int(os.environ.get("SLEEP_SECS","45"))
def handler(event, context):
    reasonA = "EVT.11 nightly smoke: force ALARM"
    reasonO = "EVT.11 nightly smoke: restore OK"
    for name in ALARM_NAMES:
        cw.set_alarm_state(AlarmName=name, StateValue="ALARM", StateReason=reasonA)
    time.sleep(SLEEP_SECS)
    for name in ALARM_NAMES:
        cw.set_alarm_state(AlarmName=name, StateValue="OK", StateReason=reasonO)
    return {"ok": True, "alarms": ALARM_NAMES}
PY
  }
}

resource "aws_lambda_function" "smoke" {
  function_name    = "lifebook-cw-alarm-smoke"
  role             = aws_iam_role.smoke.arn
  runtime          = "python3.11"
  handler          = "index.handler"
  filename         = data.archive_file.smoke_zip.output_path
  source_code_hash = data.archive_file.smoke_zip.output_base64sha256
  timeout          = 180
  memory_size      = 128

  environment {
    variables = {
      ALARM_NAMES = join(",", var.smoke_alarm_names)
      SLEEP_SECS  = "45"
    }
  }

  tags = var.tags
}

resource "aws_cloudwatch_event_rule" "smoke" {
  name                = "lifebook-cw-alarm-smoke-nightly"
  description         = "Nightly ALARM->OK smoke for EB FailedInvocations alarms"
  schedule_expression = var.smoke_cron
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "smoke" {
  rule      = aws_cloudwatch_event_rule.smoke.name
  arn       = aws_lambda_function.smoke.arn
  target_id = "lambda1"
}

resource "aws_lambda_permission" "events_invoke_smoke" {
  statement_id  = "allow-events-${aws_cloudwatch_event_rule.smoke.name}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.smoke.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.smoke.arn
}

