output "sns_topic_arn" { value = aws_sns_topic.alerts.arn }
output "kms_key_arn" { value = aws_kms_key.lifebook_synthetics.arn }
output "kms_alias_name" { value = aws_kms_alias.lifebook_synthetics.name }
output "smoke_lambda_arn" { value = aws_lambda_function.smoke.arn }
