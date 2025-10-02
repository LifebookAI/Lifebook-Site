# Load-LifebookVars.ps1 — canonical env for Lifebook work
# Dot-source this or let your profile auto-load it.

# Core
$env:LIFEBOOK_REPO        = 'LifebookAI/Lifebook-Site'
$env:LIFEBOOK_BRANCH      = 'main'
$env:LIFEBOOK_SMOKE_CTX   = 'Presign + upload (PowerShell)'

# AWS / Infra
$env:LIFEBOOK_AWS_PROFILE = 'lifebook-sso'
$env:LIFEBOOK_AWS_REGION  = 'us-east-1'
$env:LIFEBOOK_ROLE_ARN    = 'arn:aws:iam::354630286254:role/LifebookPresignDeployer'
$env:LIFEBOOK_BUCKET      = 'lifebook.ai'
$env:LIFEBOOK_S3_BUCKET   = 'lifebook.ai'
$env:LIFEBOOK_CF_ALIAS    = 'files.uselifebook.ai'
$env:LIFEBOOK_CF_DIST_ID  = 'E2D7FJLA6YQUNP'
