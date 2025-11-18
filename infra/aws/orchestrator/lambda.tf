# Orchestrator worker Lambda + IAM + SQS event source mapping
#
# NOTE:
# - Code location is parameterized via S3 bucket/key variables.
# - This is scaffold-only; we are not applying yet.
# - Once the real artifact + config are ready, we can run plan/apply.

variable "orchestrator_lambda_s3_bucket" {
  description = "S3 bucket containing the orchestrator worker Lambda artifact"
  type        = string
  default     = "lifebook.ai" # TODO: adjust if you publish artifacts elsewhere
}

variable "orchestrator_lambda_s3_key" {
  description = "S3 key for the orchestrator worker Lambda artifact"
  type        = string
  default     = "lambda/orchestrator-worker/latest.zip" # TODO: wire to CI artifact
}

# IAM role for the worker Lambda
resource "aws_iam_role" "orchestrator_lambda" {
  name = "lifebook-orchestrator-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = merge(
    local.tags,
    {
      "Role"  = "orchestrator-lambda"
      "Stack" = "orchestrator"
    }
  )
}

# Inline policy: allow reading from orchestrator queue + writing logs
resource "aws_iam_role_policy" "orchestrator_lambda" {
  name = "lifebook-orchestrator-lambda-policy"
  role = aws_iam_role.orchestrator_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = aws_sqs_queue.orchestrator.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/lifebook-orchestrator-worker*"
      }
    ]
  })
}

# Orchestrator worker Lambda function (code location parameterized)
resource "aws_lambda_function" "orchestrator_worker" {
  function_name = "lifebook-orchestrator-worker"

  role    = aws_iam_role.orchestrator_lambda.arn
  handler = "index.handler"
  runtime = "nodejs22.x"

  s3_bucket = var.orchestrator_lambda_s3_bucket
  s3_key    = var.orchestrator_lambda_s3_key

  timeout      = 30
  memory_size  = 256
  publish      = false

  environment {
    variables = {
      PROJECT        = var.project
      ENVIRONMENT    = var.environment
      ORCH_QUEUE_URL = aws_sqs_queue.orchestrator.url
      ORCH_QUEUE_ARN = aws_sqs_queue.orchestrator.arn
    }
  }

  tags = merge(
    local.tags,
    {
      "Function" = "lifebook-orchestrator-worker"
    }
  )
}

# SQS -> Lambda event source mapping
resource "aws_lambda_event_source_mapping" "orchestrator_sqs" {
  event_source_arn  = aws_sqs_queue.orchestrator.arn
  function_name     = aws_lambda_function.orchestrator_worker.arn

  batch_size                         = 10
  maximum_batching_window_in_seconds = 5

  enabled = true
}
