resource "aws_cloudwatch_composite_alarm" "orch_incident" {
  alarm_name        = "${local.name_prefix}-incident"
  alarm_description = "Critical orchestrator incident (errors, throttles, queue age, DLQ)."

  # NO anomaly clause on purpose (reduce noise)
  alarm_rule = "ALARM(\"${aws_cloudwatch_metric_alarm.lambda_errors.alarm_name}\") OR ALARM(\"${aws_cloudwatch_metric_alarm.lambda_throttles.alarm_name}\") OR ALARM(\"${aws_cloudwatch_metric_alarm.sqs_age.alarm_name}\") OR ALARM(\"${aws_cloudwatch_metric_alarm.dlq_visible.alarm_name}\")"

  actions_enabled = true
  alarm_actions   = [var.alerts_topic_arn]
  ok_actions      = [var.alerts_topic_arn]

  # Keep insufficient actions empty unless explicitly wired
  insufficient_data_actions = []

  tags = local.common_tags
}