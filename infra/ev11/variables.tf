variable "region" {
  type = string
}

variable "account_id" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "kms_admin_arns" {
  type = list(string)
}

variable "eventbridge_rule_arns" {
  type    = list(string)
  default = []
}

variable "cloudwatch_alarm_arns" {
  type    = list(string)
  default = []
}

variable "smoke_alarm_names" {
  type    = list(string)
  default = []
}

variable "smoke_cron" {
  type    = string
  default = "cron(15 8 * * ? *)"
}
