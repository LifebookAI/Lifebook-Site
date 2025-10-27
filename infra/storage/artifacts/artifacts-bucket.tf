# TODO: import: terraform import aws_s3_bucket.lifebook_artifacts_354630286254_us_east_1 lifebook-artifacts-354630286254-us-east-1
resource "aws_s3_bucket" "lifebook_artifacts_354630286254_us_east_1" {
  bucket = "lifebook-artifacts-354630286254-us-east-1"
  tags = { Project = "lifebook", Component = "artifacts" }
}
