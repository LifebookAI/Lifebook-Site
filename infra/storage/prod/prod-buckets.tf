# TODO: import: terraform import aws_s3_bucket.lifebook_354630286254_prod_processed lifebook-354630286254-prod-processed
resource "aws_s3_bucket" "lifebook_354630286254_prod_processed" {
  bucket = "lifebook-354630286254-prod-processed"
  tags = { Project = "lifebook", Environment = "prod", Component = "data" }
}

# TODO: import: terraform import aws_s3_bucket.lifebook_354630286254_prod_uploads lifebook-354630286254-prod-uploads
resource "aws_s3_bucket" "lifebook_354630286254_prod_uploads" {
  bucket = "lifebook-354630286254-prod-uploads"
  tags = { Project = "lifebook", Environment = "prod", Component = "data" }
}

# TODO: import: terraform import aws_s3_bucket.lifebook_logs_prod lifebook-logs-prod
resource "aws_s3_bucket" "lifebook_logs_prod" {
  bucket = "lifebook-logs-prod"
  tags = { Project = "lifebook", Environment = "prod", Component = "data" }
}

# TODO: import: terraform import aws_s3_bucket.lifebook_prod_processed lifebook-prod-processed
resource "aws_s3_bucket" "lifebook_prod_processed" {
  bucket = "lifebook-prod-processed"
  tags = { Project = "lifebook", Environment = "prod", Component = "data" }
}

# TODO: import: terraform import aws_s3_bucket.lifebook_prod_processed_354630286254 lifebook-prod-processed-354630286254
resource "aws_s3_bucket" "lifebook_prod_processed_354630286254" {
  bucket = "lifebook-prod-processed-354630286254"
  tags = { Project = "lifebook", Environment = "prod", Component = "data" }
}

# TODO: import: terraform import aws_s3_bucket.lifebook_prod_uploads lifebook-prod-uploads
resource "aws_s3_bucket" "lifebook_prod_uploads" {
  bucket = "lifebook-prod-uploads"
  tags = { Project = "lifebook", Environment = "prod", Component = "data" }
}

# TODO: import: terraform import aws_s3_bucket.lifebook_prod_uploads_354630286254 lifebook-prod-uploads-354630286254
resource "aws_s3_bucket" "lifebook_prod_uploads_354630286254" {
  bucket = "lifebook-prod-uploads-354630286254"
  tags = { Project = "lifebook", Environment = "prod", Component = "data" }
}

# TODO: import: terraform import aws_s3_bucket.lifebook_tfstate_354630286254_us_east_1 lifebook-tfstate-354630286254-us-east-1
resource "aws_s3_bucket" "lifebook_tfstate_354630286254_us_east_1" {
  bucket = "lifebook-tfstate-354630286254-us-east-1"
  tags = { Project = "lifebook", Environment = "prod", Component = "data" }
}

# TODO: import: terraform import aws_s3_bucket.lifebook.ai lifebook.ai
resource "aws_s3_bucket" "lifebook.ai" {
  bucket = "lifebook.ai"
  tags = { Project = "lifebook", Environment = "prod", Component = "data" }
}
