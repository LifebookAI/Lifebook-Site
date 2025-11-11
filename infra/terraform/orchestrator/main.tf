terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

provider "aws" {
  region  = "us-east-1"
  profile = "lifebook-sso"
}

locals {
  name_prefix = "lifebook-orchestrator"
}

resource "aws_sqs_queue" "dlq" {
  name                      = "${local.name_prefix}-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "queue" {
  name                       = "${local.name_prefix}-queue"
  visibility_timeout_seconds = 120
  redrive_policy             = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 5
  })
}

resource "aws_dynamodb_table" "jobs" {
  name         = "lifebook-orchestrator-jobs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }

  tags = { Project = "lifebook", Component = "orchestrator" }
}

resource "aws_iam_role" "lambda_role" {
  name = "${local.name_prefix}-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "${local.name_prefix}-lambda-policy"
  role = aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      { Effect="Allow", Action=["sqs:ReceiveMessage","sqs:DeleteMessage","sqs:GetQueueAttributes"], Resource=aws_sqs_queue.queue.arn },
      { Effect="Allow", Action=["dynamodb:PutItem","dynamodb:GetItem","dynamodb:UpdateItem","dynamodb:Query"], Resource=aws_dynamodb_table.jobs.arn },
      { Effect="Allow", Action=["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"], Resource="*" },
      { Effect="Allow", Action=["s3:PutObject","s3:GetObject"], Resource="arn:aws:s3:::lifebook.ai/*" }
    ]
  })
}

resource "aws_cloudwatch_log_group" "lg" {
  name              = "/aws/lambda/${local.name_prefix}-worker"
  retention_in_days = 60
}

resource "aws_lambda_function" "worker" {
  function_name = "${local.name_prefix}-worker"
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"

  filename         = "C:/Users/zacha/src/Lifebook-Site/services/orchestrator/dist/orchestrator_lambda.zip"
  source_code_hash = filebase64sha256("C:/Users/zacha/src/Lifebook-Site/services/orchestrator/dist/orchestrator_lambda.zip")

  environment {
    variables = {
      LF_ORCH_QUEUE_URL = aws_sqs_queue.queue.url
      LF_ORCH_TABLE     = aws_dynamodb_table.jobs.name
      NODE_OPTIONS      = "--enable-source-maps"
    }
  }

  depends_on = [aws_cloudwatch_log_group.lg, aws_iam_role_policy.lambda_policy]
}

resource "aws_lambda_event_source_mapping" "esm" {
  event_source_arn = aws_sqs_queue.queue.arn
  function_name    = aws_lambda_function.worker.arn
  batch_size       = 1
}

resource "aws_iam_role" "events_role" {
  name = "${local.name_prefix}-events-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "events.amazonaws.com" },
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "events_to_sqs" {
  name = "${local.name_prefix}-events-to-sqs"
  role = aws_iam_role.events_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect  = "Allow",
      Action  = ["sqs:SendMessage"],
      Resource= aws_sqs_queue.queue.arn
    }]
  })
}

resource "aws_cloudwatch_event_rule" "hourly" {
  name                = "${local.name_prefix}-hourly"
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "to_queue" {
  rule     = aws_cloudwatch_event_rule.hourly.name
  arn      = aws_sqs_queue.queue.arn
  role_arn = aws_iam_role.events_role.arn
  input    = jsonencode({
    jobId   = "schedule-${uuid()}"
    idemKey = "schedule-${uuid()}"
    inputs  = { url = "https://example.com" }
    outputs = { s3Out = { bucket = "lifebook.ai", key = "workflows/schedule/${uuid()}.md" } }
  })
}

output "queue_url"   { value = aws_sqs_queue.queue.url }
output "lambda_name" { value = aws_lambda_function.worker.function_name }
output "table_name"  { value = aws_dynamodb_table.jobs.name }