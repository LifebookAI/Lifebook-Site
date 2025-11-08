param(
  [string]$Profile = "lifebook-sso",
  [string]$Region  = "us-east-1",
  [array]  $Images = @(
    @{ RepoPath="library/python";  Tag="3.12-alpine" },
    @{ RepoPath="library/python";  Tag="3.11-alpine" },
    @{ RepoPath="library/ubuntu";  Tag="22.04" },
    @{ RepoPath="library/busybox"; Tag="stable-glibc" }
  )
)
$ErrorActionPreference='Stop'; Set-StrictMode -Version Latest
$env:AWS_PAGER=''; $env:AWS_DEFAULT_OUTPUT='json'
function J { param([string[]]$Cli)
  $raw = & aws @Cli 2>&1
  if($LASTEXITCODE){ throw ("aws exited {0}: {1}`n{2}" -f $LASTEXITCODE, ($Cli -join ' '), ($raw -join "`n")) }
  if([string]::IsNullOrWhiteSpace(($raw -join ''))){ $null } else { ($raw -join "`n") | ConvertFrom-Json }
}
function Json { param([Parameter(ValueFromPipeline=$true)]$In,[int]$Depth=50) process { $In | ConvertTo-Json -Depth $Depth -Compress }
function Say($m,$c='Gray'){ Write-Host $m -ForegroundColor $c }

$acct=(J @('--profile',$Profile,'--region',$Region,'sts','get-caller-identity')).Account
$registry = '{0}.dkr.ecr.{1}.amazonaws.com' -f $acct,$Region
$results = @()

foreach($i in $Images){
  $repo = "dkrhub/{0}" -f $i.RepoPath
  $tag  = $i.Tag
  Say ("[seed] batch-get-image {0}:{1}" -f $repo,$tag) 'Yellow'
  try{
    J @('--profile',$Profile,'--region',$Region,'ecr','batch-get-image',
       '--repository-name',$repo,'--image-ids',(Json @{ imageTag=$tag }),
       '--accepted-media-types','application/vnd.docker.distribution.manifest.v2+json','application/vnd.docker.distribution.manifest.list.v2+json') | Out-Null
  }catch{
    Say ("[seed][info] call errored (import may still be async): {0}" -f $_.Exception.Message) 'DarkGray'
  }

  $digest=$null; $until=(Get-Date).AddSeconds(150)
  do{
    try{
      $desc = J @('--profile',$Profile,'--region',$Region,'ecr','describe-images','--repository-name',$repo,'--image-ids',(Json @{ imageTag=$tag }))
      if($desc.imageDetails){ $digest = $desc.imageDetails[0].imageDigest }
    }catch{}
    if(-not $digest){ Start-Sleep 5 }
  } while(-not $digest -and (Get-Date) -lt $until)
  if(-not $digest){ throw ("Digest never appeared for {0}:{1}" -f $repo,$tag) }

  $results += [pscustomobject]@{ Repo=$repo; Tag=$tag; Digest=$digest; ImageUri=('{0}/{1}:{2}' -f $registry,$repo,$tag) }
  Say ("[verify] {0}:{1} -> {2}" -f $repo,$tag,$digest) 'DarkGreen'
}
$results
