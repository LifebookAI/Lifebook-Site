param(
  [string]$Container = 'lifebook-postgres-dev',
  [string]$DbName    = 'lifebook_dev',
  [string]$DbUser    = 'lifebook',
  [int]   $Port      = 5432,
  [string]$Volume    = 'lifebook_site_pgdata',
  [switch]$ResetData,
  [switch]$NoCommit
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

$Repo = (Get-Location).Path
$EnvLocal = Join-Path $Repo '.env.local'

# Guard: ensure .env.local is ignored
& git check-ignore -q -- '.env.local'
if ($LASTEXITCODE -ne 0) { throw ".env.local is NOT ignored by git. Add it to .gitignore before continuing." }

# Docker sanity
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "docker CLI not found. Install Docker Desktop." }
& docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker engine not reachable. Start Docker Desktop, then rerun." }

# Load env
Import-DotEnvFile $EnvLocal
Import-DotEnvFile (Join-Path $Repo '.env')

# Ensure DATABASE_URL exists (create deterministic dev URL if missing)
if (-not $env:DATABASE_URL) {
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $pw = (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
  $env:DATABASE_URL = ('postgres://{0}:{1}@127.0.0.1:{2}/{3}' -f $DbUser, $pw, $Port, $DbName)
  Upsert-EnvLine -Path $EnvLocal -Key 'DATABASE_URL' -Value $env:DATABASE_URL
}

Write-Host ("DATABASE_URL(masked): " + (Mask-PgUrl $env:DATABASE_URL)) -ForegroundColor DarkGray

# Parse pw from DATABASE_URL (never print)
$u = [Uri]$env:DATABASE_URL
if (-not $u.UserInfo -or -not $u.UserInfo.Contains(':')) { throw "DATABASE_URL must include user:password@... (dev only)" }
$pw = $u.UserInfo.Split(':',2)[1]

# Optional reset (data wipe)
if ($ResetData) {
  if (@(docker ps -a --format '{{.Names}}') -contains $Container) { docker rm -f $Container | Out-Null }
  if (@(docker volume ls --format '{{.Name}}') -contains $Volume) { docker volume rm $Volume | Out-Null }
}

# Start container if missing/not running
$running = @(docker ps --format '{{.Names}}') -contains $Container
$exists  = @(docker ps -a --format '{{.Names}}') -contains $Container

if ($exists -and -not $running) {
  docker start $Container | Out-Null
} elseif (-not $exists) {
  # IMPORTANT: avoid "$Volume:" parsing bug by formatting the string
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
if ($pm -ne 'pnpm') {
  Write-Host "NOTE: lockfile suggests $pm, but this repo has been using pnpm in practice. Proceeding with $pm." -ForegroundColor DarkGray
}

$pkgJsonPath = Join-Path $Repo 'package.json'
if (-not (Test-Path -LiteralPath $pkgJsonPath)) { throw "package.json not found at repo root." }
$pkg = Get-Content -LiteralPath $pkgJsonPath -Raw | ConvertFrom-Json
$scripts = $pkg.scripts

function Invoke-PackageScript([string]$Name) {
  if (-not $scripts) { return $false }
  $props = $scripts.PSObject.Properties.Name
  if ($props -notcontains $Name) { return $false }

  Write-Host "Running package script: $Name" -ForegroundColor Yellow
  if ($pm -eq 'pnpm') { & pnpm -s $Name | Out-Host }
  elseif ($pm -eq 'yarn') { & yarn $Name | Out-Host }
  else { & npm run -s $Name | Out-Host }

  if ($LASTEXITCODE -ne 0) { throw "Script failed: $Name" }
  return $true
}

$applied = $false

# Preferred: repo-provided migration script(s)
$applied = (Invoke-PackageScript 'db:migrate')
if (-not $applied) { $applied = (Invoke-PackageScript 'migrate') }

# Prisma fallback (non-interactive)
if (-not $applied -and (Test-Path -LiteralPath (Join-Path $Repo 'prisma\schema.prisma'))) {
  Write-Host "Detected Prisma. Applying migrations..." -ForegroundColor Yellow
  $mDir = Join-Path $Repo 'prisma\migrations'
  if (Test-Path -LiteralPath $mDir -and @(Get-ChildItem -LiteralPath $mDir -Directory -ErrorAction SilentlyContinue).Count -gt 0) {
    if ($pm -eq 'pnpm') { & pnpm -s prisma migrate deploy | Out-Host } else { & npx prisma migrate deploy | Out-Host }
  } else {
    if ($pm -eq 'pnpm') { & pnpm -s prisma db push | Out-Host } else { & npx prisma db push | Out-Host }
  }
  if ($LASTEXITCODE -ne 0) { throw "Prisma migration/push failed." }
  $applied = $true
}

# Raw SQL fallback (db/migrations/*.sql)
if (-not $applied) {
  $sqlDir = Join-Path $Repo 'db\migrations'
  if (Test-Path -LiteralPath $sqlDir) {
    $sqlFiles = @(Get-ChildItem -LiteralPath $sqlDir -Filter '*.sql' -File | Sort-Object Name)
    if ($sqlFiles.Count -eq 0) { throw "Found db/migrations but no .sql files." }

    Write-Host ("Applying {0} SQL migration(s) via docker exec psql..." -f $sqlFiles.Count) -ForegroundColor Yellow
    foreach ($f in $sqlFiles) {
      Write-Host ("- {0}" -f $f.Name) -ForegroundColor DarkGray
      $raw = Get-Content -LiteralPath $f.FullName -Raw
      # feed SQL to psql stdin; PGPASSWORD supplied as env var (not printed)
      $raw | docker exec -i -e ("PGPASSWORD=$pw") $Container `
        psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName -f - | Out-Host
      if ($LASTEXITCODE -ne 0) { throw "SQL migration failed: $($f.Name)" }
    }
    $applied = $true
  }
}

if (-not $applied) {
  throw "No migration method found. Add a db:migrate script, Prisma schema, or db/migrations/*.sql."
}

Write-Host "OK: schema/migrations applied." -ForegroundColor Green

# ---- Introspect (all non-system schemas) ----
$tmpDir = Join-Path $Repo '.tmp'
if (-not (Test-Path -LiteralPath $tmpDir)) { New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null }
$jsPath = Join-Path $tmpDir 'lifebook_db_introspect_all_schemas.cjs'

$js = @'
const {Pool}=require('pg');
const pool=new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 3000,
  statement_timeout: 5000,
  query_timeout: 5000
});

(async()=>{
  await pool.query('select 1');

  const all = await pool.query(
    `select table_schema, table_name
     from information_schema.tables
     where table_type='BASE TABLE'
       and table_schema not in ('pg_catalog','information_schema')
     order by table_schema, table_name`
  );

  const tables = all.rows;

  const re = /(run|job|workflow|task|artifact|scan|orchestrator)/i;
  const candidates = tables.filter(r=>re.test(r.table_name));

  const out = [];
  for (const r of candidates) {
    const c = await pool.query(
      `select column_name, data_type
       from information_schema.columns
       where table_schema=$1 and table_name=$2
       order by ordinal_position`,
      [r.table_schema, r.table_name]
    );
    out.push({ schema: r.table_schema, table: r.table_name, columns: c.rows });
  }

  console.log(JSON.stringify({ tables_total: tables.length, candidates: out }, null, 2));
  await pool.end();
})().catch(async(e)=>{
  console.error(String(e && e.stack ? e.stack : e));
  try{ await pool.end(); } catch {}
  process.exit(2);
});