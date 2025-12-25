param(
  [string]$Container = 'lifebook-postgres-dev',
  [string]$DbName    = 'lifebook_dev',
  [string]$DbUser    = 'lifebook',
  [int]   $Port      = 5432,
  [string]$Volume    = 'lifebook_site_pgdata',
  [switch]$ResetData
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $d = Split-Path -Parent $Path
  if ($d -and -not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}
function Import-DotEnvFile([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  foreach ($ln in Get-Content -LiteralPath $Path) {
    $t = $ln.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    if ($t -notmatch '^[A-Za-z_][A-Za-z0-9_]*=') { continue }
    $key, $val = $t.Split('=', 2)
    $key = $key.Trim(); $val = $val.Trim()
    if ($val.StartsWith('"') -and $val.EndsWith('"') -and $val.Length -ge 2) { $val = $val.Substring(1, $val.Length-2) }
    if ($val.StartsWith("'") -and $val.EndsWith("'") -and $val.Length -ge 2) { $val = $val.Substring(1, $val.Length-2) }
    Set-Item -Path "Env:$key" -Value $val
  }
}
function Upsert-EnvLine([string]$Path, [string]$Key, [string]$Value) {
  $lines = @()
  if (Test-Path -LiteralPath $Path) { $lines = @(Get-Content -LiteralPath $Path) }
  $re = "^(?<k>\s*{0}\s*)=" -f [Regex]::Escape($Key)
  $found = $false
  for ($i=0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $re) { $lines[$i] = "$Key=$Value"; $found = $true; break }
  }
  if (-not $found) { $lines += "$Key=$Value" }
  Write-Utf8NoBom $Path (($lines -join "`r`n") + "`r`n")
}
function Mask-PgUrl([string]$u) {
  if (-not $u) { return '' }
  return ($u -replace '(?i)^(postgres(?:ql)?://)([^@]+)@', '$1***@')
}
function Wait-Until([scriptblock]$Test, [int]$MaxSeconds = 60, [int]$SleepMs = 750) {
  $start = Get-Date
  while (((Get-Date) - $start).TotalSeconds -lt $MaxSeconds) {
    try { if (& $Test) { return $true } } catch {}
    Start-Sleep -Milliseconds $SleepMs
  }
  return $false
}
function Get-PkgManager([string]$RepoRoot) {
  if (Test-Path -LiteralPath (Join-Path $RepoRoot 'pnpm-lock.yaml')) { return 'pnpm' }
  if (Test-Path -LiteralPath (Join-Path $RepoRoot 'yarn.lock')) { return 'yarn' }
  return 'npm'
}
function Invoke-PkgScript([string]$Pm, [psobject]$Scripts, [string]$Name) {
  if (-not $Scripts) { return $false }
  $props = $Scripts.PSObject.Properties.Name
  if ($props -notcontains $Name) { return $false }

  Write-Host "Running package script: $Name" -ForegroundColor Yellow
  if ($Pm -eq 'pnpm')      { & pnpm -s $Name | Out-Host }
  elseif ($Pm -eq 'yarn')  { & yarn $Name | Out-Host }
  else                     { & npm run -s $Name | Out-Host }

  if ($LASTEXITCODE -ne 0) { throw "Script failed: $Name" }
  return $true
}

# Resolve repo root from script location
$Repo = Resolve-Path (Join-Path $PSScriptRoot '..\..\..') | Select-Object -ExpandProperty Path
$EnvLocal = Join-Path $Repo '.env.local'

# Guard: ensure .env.local is ignored
& git -C $Repo check-ignore -q -- '.env.local'
if ($LASTEXITCODE -ne 0) { throw ".env.local is NOT ignored by git. Add it to .gitignore before continuing." }

# Docker sanity
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "docker CLI not found. Install Docker Desktop." }
& docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker engine not reachable. Start Docker Desktop, then rerun." }

# Load env (non-destructive)
Import-DotEnvFile $EnvLocal
Import-DotEnvFile (Join-Path $Repo '.env')

# Ensure DATABASE_URL exists (dev only; secret never printed)
if (-not $env:DATABASE_URL) {
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $pwGen = (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
  $env:DATABASE_URL = ('postgres://{0}:{1}@127.0.0.1:{2}/{3}' -f $DbUser, $pwGen, $Port, $DbName)
  Upsert-EnvLine -Path $EnvLocal -Key 'DATABASE_URL' -Value $env:DATABASE_URL
}

# Normalize localhost -> 127.0.0.1
try {
  $u0 = [Uri]$env:DATABASE_URL
  if ($u0.Host -eq 'localhost') {
    $env:DATABASE_URL = ($env:DATABASE_URL -replace '://([^@]+)@localhost:', '://$1@127.0.0.1:')
    Upsert-EnvLine -Path $EnvLocal -Key 'DATABASE_URL' -Value $env:DATABASE_URL
  }
} catch {}

Write-Host ("DATABASE_URL(masked): " + (Mask-PgUrl $env:DATABASE_URL)) -ForegroundColor DarkGray

# Parse pw from DATABASE_URL
$u = [Uri]$env:DATABASE_URL
if (-not $u.UserInfo -or -not $u.UserInfo.Contains(':')) { throw "DATABASE_URL must include user:password@... (dev only)" }
$pw = $u.UserInfo.Split(':',2)[1]

# Safety: if another container owns host port, fail
$owners = @(docker ps --format '{{.Names}} {{.Ports}}' | Where-Object { $_ -match "(:$Port->|0\.0\.0\.0:$Port->|\[::\]:$Port->)" })
if ($owners.Count -gt 0) {
  $ourOwns = $false
  foreach ($l in $owners) { if ($l -match "^\Q$Container\E\s") { $ourOwns = $true } }
  if (-not $ourOwns) {
    Write-Host "Host port $Port is already bound by another container. Resolve and rerun." -ForegroundColor Red
    $owners | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    throw "Port conflict"
  }
}

# Optional reset
if ($ResetData) {
  if (@(docker ps -a --format '{{.Names}}') -contains $Container) { docker rm -f $Container | Out-Null }
  if (@(docker volume ls --format '{{.Name}}') -contains $Volume) { docker volume rm $Volume | Out-Null }
}

# Start container
$running = @(docker ps --format '{{.Names}}') -contains $Container
$exists  = @(docker ps -a --format '{{.Names}}') -contains $Container

if ($exists -and -not $running) {
  docker start $Container | Out-Null
} elseif (-not $exists) {
  docker run -d --name $Container `
    -e ("POSTGRES_DB=$DbName") `
    -e ("POSTGRES_USER=$DbUser") `
    -e ("POSTGRES_PASSWORD=$pw") `
    -p ("{0}:5432" -f $Port) `
    -v ("{0}:/var/lib/postgresql/data" -f $Volume) `
    postgres:16-alpine | Out-Null
}

$ready = Wait-Until -MaxSeconds 60 -Test {
  & docker exec $Container pg_isready -U $DbUser -d $DbName *> $null
  return ($LASTEXITCODE -eq 0)
}
if (-not $ready) { throw "Postgres did not become ready. Check: docker logs $Container" }
Write-Host "OK: Postgres container is ready." -ForegroundColor Green

# ---- Apply migrations / schema ----
$pm = Get-PkgManager $Repo
if ($pm -eq 'pnpm' -and -not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "pnpm-lock.yaml found but pnpm is not installed." }
if ($pm -eq 'yarn' -and -not (Get-Command yarn -ErrorAction SilentlyContinue)) { throw "yarn.lock found but yarn is not installed." }
if ($pm -eq 'npm'  -and -not (Get-Command npm  -ErrorAction SilentlyContinue)) { throw "npm not found." }

$pkgJsonPath = Join-Path $Repo 'package.json'
if (-not (Test-Path -LiteralPath $pkgJsonPath)) { throw "package.json not found at repo root." }
$pkg = Get-Content -LiteralPath $pkgJsonPath -Raw | ConvertFrom-Json
$scripts = $pkg.scripts

$applied = $false
$preferred = @('db:migrate','migrate','db:deploy','db:push','drizzle:migrate','db:setup')
foreach ($n in $preferred) {
  if (Invoke-PkgScript -Pm $pm -Scripts $scripts -Name $n) { $applied = $true; break }
}

# Prisma fallback
if (-not $applied -and (Test-Path -LiteralPath (Join-Path $Repo 'prisma\schema.prisma'))) {
  Write-Host "Detected Prisma. Applying migrations..." -ForegroundColor Yellow
  $mDir = Join-Path $Repo 'prisma\migrations'
  if (Test-Path -LiteralPath $mDir -and @(Get-ChildItem -LiteralPath $mDir -Directory -ErrorAction SilentlyContinue).Count -gt 0) {
    if ($pm -eq 'pnpm') { & pnpm exec prisma migrate deploy | Out-Host } else { & npx prisma migrate deploy | Out-Host }
  } else {
    if ($pm -eq 'pnpm') { & pnpm exec prisma db push | Out-Host } else { & npx prisma db push | Out-Host }
  }
  if ($LASTEXITCODE -ne 0) { throw "Prisma migration/push failed." }
  $applied = $true
}

# Raw SQL fallback
if (-not $applied) {
  $sqlDir = Join-Path $Repo 'db\migrations'
  if (Test-Path -LiteralPath $sqlDir) {
    $sqlFiles = @(Get-ChildItem -LiteralPath $sqlDir -Filter '*.sql' -File | Sort-Object Name)
    if ($sqlFiles.Count -eq 0) { throw "Found db/migrations but no .sql files." }

    Write-Host ("Applying {0} SQL migration(s) via docker exec psql..." -f $sqlFiles.Count) -ForegroundColor Yellow
    foreach ($f in $sqlFiles) {
      Write-Host ("- {0}" -f $f.Name) -ForegroundColor DarkGray
      $raw = Get-Content -LiteralPath $f.FullName -Raw
      $raw | docker exec -i -e ("PGPASSWORD=$pw") $Container `
        psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName -f - | Out-Host
      if ($LASTEXITCODE -ne 0) { throw "SQL migration failed: $($f.Name)" }
    }
    $applied = $true
  }
}

if (-not $applied) { throw "No migration method found (no scripts, no Prisma schema, no db/migrations/*.sql)." }
Write-Host "OK: schema/migrations applied." -ForegroundColor Green

