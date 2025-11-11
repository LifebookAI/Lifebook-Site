param(
  [string]$ApiBase = "http://localhost:3000",
  [string]$WorkspaceId = "ws-e2e",
  [string]$FileName = "hello.txt",
  [string]$ContentType = "text/plain",
  [string]$Profile = "lifebook-sso",
  [string]$Region  = "us-east-1",
  [string]$Bucket  = "lifebook.ai"
)
Set-StrictMode -Version Latest; $ErrorActionPreference='Stop'

function Get-Sha256Hex([byte[]]$bytes){
  return -join (([System.Security.Cryptography.SHA256]::Create()).ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") })
}
function To-Base64([string]$hex){
  [Convert]::ToBase64String([byte[]]([byte[]]::new(($hex.Length/2)) | ForEach-Object -Begin { $i=0 } -Process {
    $b = [Convert]::ToByte($hex.Substring($i,2),16); $i+=2; $b
  }))
}

$data = [Text.Encoding]::UTF8.GetBytes("hello lifebook")
$shaHex = Get-Sha256Hex $data
$body = @{ workspaceId = $WorkspaceId; fileName = $FileName; contentType = $ContentType; sha256 = $shaHex } | ConvertTo-Json
$res = Invoke-RestMethod -Method Post -Uri "$ApiBase/api/presign" -ContentType 'application/json' -Body $body

if(-not $res.url){ throw "presign failed: no url" }
"`n[info] key: $($res.key) guid: $($res.guid)"

# Upload with signed headers (must match exactly)
$headers = @{}
$headers['x-amz-checksum-sha256'] = To-Base64 $shaHex
$headers['x-amz-server-side-encryption'] = 'aws:kms'
$headers['x-amz-server-side-encryption-aws-kms-key-id'] = 'arn:aws:kms:us-east-1:354630286254:key/583a1a4c-efbc-486d-8025-66577c04116a'

Invoke-WebRequest -Method Put -Uri $res.url -ContentType $ContentType -Headers $headers -Body $data | Out-Null

# Head verify
$head = aws s3api head-object --bucket $Bucket --key $res.key --profile $Profile --region $Region | ConvertFrom-Json
if($head.ServerSideEncryption -ne 'aws:kms'){ throw "SSE-KMS not set" }
if(-not $head.SSEKMSKeyId){ throw "SSE KMS KeyId missing" }
if(-not $head.ChecksumSHA256){ throw "Checksum missing" }

# Wait for ingest artifacts
$guid = $res.guid
"`n[info] waiting for catalog artifacts for $guid ..."
$deadline = (Get-Date).AddMinutes(2)
$metaKey = "catalog/meta/$guid.json"
$txKey   = "catalog/transcripts/$guid.json"

function Wait-Key([string]$k){
  while((Get-Date) -lt $deadline){
    try{ aws s3api head-object --bucket $Bucket --key $k --profile $Profile --region $Region | Out-Null; return $true }catch{ Start-Sleep 3 }
  }
  return $false
}
if(-not (Wait-Key $metaKey)){ throw "meta not found: $metaKey" }
if(-not (Wait-Key $txKey)){  throw "transcript not found: $txKey" }

$metaTxt = aws s3 cp "s3://$Bucket/$metaKey" - --profile $Profile --region $Region
$metaObj = $metaTxt | ConvertFrom-Json
if($metaObj.guid -ne $guid -or $metaObj.workspaceId -ne $WorkspaceId){ throw "meta content mismatch" }

Write-Host "`n*** GREEN: Presign + upload + ingest verified. ***" -ForegroundColor Green