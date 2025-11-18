terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "aws_region" {
  description = "AWS region for orchestrator stack"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project tag"
  type        = string
  default     = "lifebook"
}

variable "environment" {
  description = "Environment tag"
  type        = string
  default     = "prod"
}

locals {
  tags = {
    Project = var.project
    Env     = var.environment
    Owner   = "platform"
    Stack   = "orchestrator"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = "lifebook-sso"
  # Ensure you've run: aws sso login --profile lifebook-sso
}
