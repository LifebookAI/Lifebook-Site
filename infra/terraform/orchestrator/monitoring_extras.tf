# === Monitoring extras: anomaly detection + composite alarm + dashboard alarm tile ===

# Anomaly detection on Lambda Invocations (spike/drop)
resource "aws_cloudwatch_metric_alarm" "lambda_invocations_anom" {
  alarm_name          = "${local.name_prefix}-invocations-anom"
  comparison_operator = "GreaterThanUpperThreshold"
  evaluation_periods  = 5
  threshold_metric_id = "ad1"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alerts_topic_arn]
  ok_actions          = [var.alerts_topic_arn]

  metric_query {
    id = "m1"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Invocations"
      dimensions  = { FunctionName = aws_lambda_function.worker.function_name }
      period      = 60
      stat        = "Sum"
    }
    return_data = false
  }

  metric_query {
    id          = "ad1"
    expression  = "ANOMALY_DETECTION_BAND(m1, 2)"
    label       = "Invocations (anomaly band)"
    return_data = true
  }
}

# Composite: page once when any critical alarm is ALARM
resource "aws_cloudwatch_composite_alarm" "orch_incident" {
  alarm_name    = "${local.name_prefix}-incident"
  alarm_actions = [var.alerts_topic_arn]
  ok_actions    = [var.alerts_topic_arn]
  alarm_rule    = join(" OR ", [
    "ALARM(\"${aws_cloudwatch_metric_alarm.lambda_errors.alarm_name}\")",
    "ALARM(\"${aws_cloudwatch_metric_alarm.lambda_throttles.alarm_name}\")",
    "ALARM(\"${aws_cloudwatch_metric_alarm.sqs_age.alarm_name}\")",
    "ALARM(\"${aws_cloudwatch_metric_alarm.dlq_visible.alarm_name}\")",
    "ALARM(\"${aws_cloudwatch_metric_alarm.lambda_invocations_anom.alarm_name}\")"
  ])
}

# Extend dashboard: add an alarm tile with the key alarms
resource "aws_cloudwatch_dashboard" "orch_overview_alarms_tile" {
  dashboard_name = aws_cloudwatch_dashboard.orch_overview.dashboard_name
  dashboard_body = jsonencode({
    widgets = concat(
      jsondecode(aws_cloudwatch_dashboard.orch_overview.dashboard_body).widgets,
      [
        {
          "type":"alarm","width":24,"height":6,"x":0,"y":12,
          "properties":{
            "title":"Orchestrator Alarms",
            "alarms":[
              aws_cloudwatch_metric_alarm.lambda_errors.arn,
              aws_cloudwatch_metric_alarm.lambda_throttles.arn,
              aws_cloudwatch_metric_alarm.sqs_age.arn,
              aws_cloudwatch_metric_alarm.dlq_visible.arn,
              aws_cloudwatch_metric_alarm.lambda_invocations_anom.arn,
              aws_cloudwatch_composite_alarm.orch_incident.arn
            ]
          }
        }
      ]
    )
  })
}