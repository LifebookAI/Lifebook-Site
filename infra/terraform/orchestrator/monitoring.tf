variable "alerts_topic_arn" { type = string, default = "arn:aws:sns:us-east-1:354630286254:lifebook-alerts" }

# Lambda error > 0 (1 min)
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${local.name_prefix}-errors>0-1m"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  dimensions          = { FunctionName = aws_lambda_function.worker.function_name }
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alerts_topic_arn]
  ok_actions          = [var.alerts_topic_arn]
}

# Lambda throttles > 0 (1 min)
resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "${local.name_prefix}-throttles>0-1m"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  dimensions          = { FunctionName = aws_lambda_function.worker.function_name }
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alerts_topic_arn]
  ok_actions          = [var.alerts_topic_arn]
}

# Queue age > 60s (messages aren't getting processed)
resource "aws_cloudwatch_metric_alarm" "sqs_age" {
  alarm_name          = "${local.name_prefix}-queue-age>60s"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 60
  dimensions          = { QueueName = aws_sqs_queue.queue.name }
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alerts_topic_arn]
  ok_actions          = [var.alerts_topic_arn]
}

# DLQ visible > 0 (redrive happening)
resource "aws_cloudwatch_metric_alarm" "dlq_visible" {
  alarm_name          = "${local.name_prefix}-dlq-visible>0"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  dimensions          = { QueueName = aws_sqs_queue.dlq.name }
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alerts_topic_arn]
  ok_actions          = [var.alerts_topic_arn]
}

# Dashboard
resource "aws_cloudwatch_dashboard" "orch_overview" {
  dashboard_name = "Lifebook-Orchestrator-Overview"
  dashboard_body = jsonencode({
    widgets = [
      {
        "type":"metric","width":12,"height":6,"x":0,"y":0,"properties":{
          "title":"Lambda Invocations/Errors/Throttles",
          "region":"us-east-1",
          "metrics":[
            [ "AWS/Lambda","Invocations","FunctionName", aws_lambda_function.worker.function_name, { "stat":"Sum" } ],
            [ ".",         "Errors",     ".",            ".",                          { "stat":"Sum","yAxis":"right" } ],
            [ ".",         "Throttles",  ".",            ".",                          { "stat":"Sum","yAxis":"right" } ]
          ],
          "view":"timeSeries","stacked":false,"period":60
        }
      },
      {
        "type":"metric","width":12,"height":6,"x":12,"y":0,"properties":{
          "title":"Lambda Duration (p50/p95)","region":"us-east-1",
          "metrics":[
            [ "AWS/Lambda","Duration","FunctionName", aws_lambda_function.worker.function_name, { "stat":"p50" } ],
            [ ".","Duration",".",".",{ "stat":"p95" } ]
          ],
          "view":"timeSeries","stacked":false,"period":60
        }
      },
      {
        "type":"metric","width":12,"height":6,"x":0,"y":6,"properties":{
          "title":"SQS Queue Depth / Age","region":"us-east-1",
          "metrics":[
            [ "AWS/SQS","ApproximateNumberOfMessagesVisible","QueueName", aws_sqs_queue.queue.name, { "stat":"Maximum" } ],
            [ ".","ApproximateAgeOfOldestMessage",".",".", { "stat":"Maximum","yAxis":"right" } ]
          ],
          "view":"timeSeries","stacked":false,"period":60
        }
      },
      {
        "type":"metric","width":12,"height":6,"x":12,"y":6,"properties":{
          "title":"SQS DLQ Visible","region":"us-east-1",
          "metrics":[
            [ "AWS/SQS","ApproximateNumberOfMessagesVisible","QueueName", aws_sqs_queue.dlq.name, { "stat":"Maximum" } ]
          ],
          "view":"timeSeries","stacked":false,"period":60
        }
      }
    ]
  })
}