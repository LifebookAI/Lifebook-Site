# Load-LifebookVars.ps1  (idempotent)
# Central place for Lifebook env across shells & scripts.

# Core
$env:LIFEBOOK_AWS_REGION     = 'us-east-1'
$env:LIFEBOOK_S3_BUCKET      = 'lifebook.ai'

# CloudFront
$env:LIFEBOOK_CF_ALIAS       = 'files.uselifebook.ai'
$env:LIFEBOOK_CF_DIST_ID     = ''

# Optional: other known vars (keep if you already use them)
# $env:PRESIGN_API_BASE       = ''
# $env:LIST_API_URL          = ''
# $env:APP_BASE_URL          = ''
