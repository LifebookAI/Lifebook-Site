terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}
# Lifebook.AI — S3 lifecycle for catalog prefixes (D.S2)
# Managed by Terraform. Do not edit in console or it will drift.
# Bucket: lifebook.ai

resource "aws_s3_bucket_lifecycle_configuration" "catalog" {
  bucket = var.bucket_name

  # Abort incomplete MPUs after 7 days (bucket-wide safety)
  rule {
    id     = "abort-mpu-7d"
    status = "Enabled"
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  # catalog/transcripts → IA 30d → Glacier IR 180d (+ noncurrent)
  rule {
    id     = "catalog-transcripts-ia30-glacierir180"
    status = "Enabled"
    filter { prefix = "catalog/transcripts/" }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 180
      storage_class = "GLACIER_IR"
    }
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
    noncurrent_version_transition {
      noncurrent_days = 180
      storage_class   = "GLACIER_IR"
    }
  }

  # catalog/keyframes → IA 30d → Glacier IR 180d (+ noncurrent)
  rule {
    id     = "catalog-keyframes-ia30-glacierir180"
    status = "Enabled"
    filter { prefix = "catalog/keyframes/" }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 180
      storage_class = "GLACIER_IR"
    }
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
    noncurrent_version_transition {
      noncurrent_days = 180
      storage_class   = "GLACIER_IR"
    }
  }

  # catalog/proxies → IA 30d → Glacier IR 180d (+ noncurrent)
  rule {
    id     = "catalog-proxies-ia30-glacierir180"
    status = "Enabled"
    filter { prefix = "catalog/proxies/" }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 180
      storage_class = "GLACIER_IR"
    }
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
    noncurrent_version_transition {
      noncurrent_days = 180
      storage_class   = "GLACIER_IR"
    }
  }

  # catalog/masters → IA 30d → Glacier IR 90d (+ noncurrent)
  rule {
    id     = "catalog-masters-ia30-glacierir90"
    status = "Enabled"
    filter { prefix = "catalog/masters/" }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER_IR"
    }
  }
}

provider "aws" {
  profile = var.aws_profile

  region = var.aws_region

}
variable "aws_region" {
  type    = string
  default = "us-east-1"
}
variable "bucket_name" {
  type    = string
  default = "lifebook.ai"
}

variable "aws_profile" {
  type    = string
  default = "lifebook-sso"
}
