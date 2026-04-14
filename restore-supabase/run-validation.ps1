param(
  [string]$ConnectionString = $env:SUPABASE_DB_URL,
  [string]$ValidationPath = (Join-Path $PSScriptRoot 'validate.sql'),
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
  throw 'Provide -ConnectionString or set SUPABASE_DB_URL before running run-validation.ps1.'
}

if (-not (Test-Path -LiteralPath $ValidationPath)) {
  throw "Validation SQL not found: $ValidationPath"
}

$psqlPath = Resolve-Psql $PsqlCommand

Write-Host "Using psql from: $psqlPath"
Write-Host "Running validation script: $ValidationPath"

& $psqlPath $ConnectionString -v ON_ERROR_STOP=1 -f $ValidationPath
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
  throw "Validation failed with exit code $exitCode"
}

Write-Host 'Validation completed.'
