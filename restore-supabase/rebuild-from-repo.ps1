param(
  [string]$ConnectionString = $env:SUPABASE_DB_URL,
  [string]$ScriptPath = (Join-Path $PSScriptRoot 'rebuild-from-repo.sql'),
  [string]$PsqlCommand = 'psql'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Resolve-Psql([string]$CommandName) {
  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'PostgreSQL\17.9\pgsql\bin\psql.exe'),
    (Join-Path $env:LOCALAPPDATA 'PostgreSQL\17.9\bin\psql.exe')
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  throw 'psql is not installed or not on PATH. Install the latest PostgreSQL client tools first.'
}

if (-not $ConnectionString) {
  throw 'Provide -ConnectionString or set SUPABASE_DB_URL before running rebuild-from-repo.ps1.'
}

if (-not (Test-Path -LiteralPath $ScriptPath)) {
  throw "Fallback SQL not found: $ScriptPath"
}

$psqlPath = Resolve-Psql $PsqlCommand

Write-Host "Using psql from: $psqlPath"
Write-Host "Rebuilding schema from repo files: $ScriptPath"

& $psqlPath $ConnectionString -v ON_ERROR_STOP=1 -f $ScriptPath
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
  throw "Fallback rebuild failed with exit code $exitCode"
}

Write-Host 'Repo schema rebuild completed.'
Write-Host 'Next step: run .\restore-supabase\run-validation.ps1'
