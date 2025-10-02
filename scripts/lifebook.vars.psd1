{
  "Repo": "LifebookAI/Lifebook-Site",
  "CloudFront": {
    "DistId": "E2D7FJLA6YQUNP",
    "Alias": "files.uselifebook.ai"
  },
  "SmokeCtx": "Presign + upload (PowerShell)",
  "Storage": {
    "S3Bucket": "lifebook.ai",
    "Bucket": "lifebook.ai"
  },
  "Branch": "main",
  "Aws": {
    "Region": "us-east-1",
    "Profile": "lifebook-sso",
    "RoleArn": "arn:aws:iam::354630286254:role/LifebookPresignDeployer"
  }
}
