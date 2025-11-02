locals {
  alerts_topic_name = "lifebook-alerts"
  alerts_topic_arn  = "arn:aws:sns:${var.region}:${var.account_id}:${local.alerts_topic_name}"
}
