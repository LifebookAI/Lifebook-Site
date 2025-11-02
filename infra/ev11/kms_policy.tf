data "aws_iam_policy_document" "kms" {
  # 1) Full admin: account root
  statement {
    sid       = "AllowAccountRoot"
    effect    = "Allow"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.account_id}:root"]
    }
  }

  # 2) Your KMS admins (roles/users)
  statement {
    sid       = "AllowKmsAdmins"
    effect    = "Allow"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = var.kms_admin_arns
    }
  }

  # 3) SNS may use this CMK for the specific topic (Principal="*", gated by conditions)
  statement {
    sid       = "AllowSNSUseOfKeyForTopic"
    effect    = "Allow"
    actions   = ["kms:GenerateDataKey*", "kms:DescribeKey", "kms:Decrypt"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["sns.${var.region}.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.account_id]
    }
    condition {
      test     = "StringEqualsIfExists"
      variable = "kms:EncryptionContext:aws:sns:topicArn"
      values   = [local.alerts_topic_arn]
    }
  }

  # 4) SNS CreateGrant for AWS resources (same gating)
  statement {
    sid       = "AllowSNSCreateGrantForTopic"
    effect    = "Allow"
    actions   = ["kms:CreateGrant"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "kms:GrantIsForAWSResource"
      values   = ["true"]
    }
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["sns.${var.region}.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.account_id]
    }
  }

  # 5) CloudWatch Alarms publish via SNS → same KMS use (Principal="*")
  statement {
    sid       = "AllowCloudWatchUseOfKey"
    effect    = "Allow"
    actions   = ["kms:GenerateDataKey*", "kms:DescribeKey", "kms:Decrypt"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["sns.${var.region}.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.account_id]
    }
    condition {
      test     = "StringEqualsIfExists"
      variable = "kms:EncryptionContext:aws:sns:topicArn"
      values   = [local.alerts_topic_arn]
    }
  }

  # 6) CloudWatch CreateGrant
  statement {
    sid       = "AllowCloudWatchCreateGrant"
    effect    = "Allow"
    actions   = ["kms:CreateGrant"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "kms:GrantIsForAWSResource"
      values   = ["true"]
    }
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["sns.${var.region}.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.account_id]
    }
  }
}
