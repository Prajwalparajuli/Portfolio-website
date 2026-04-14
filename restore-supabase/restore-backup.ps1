param(
  [string]$ConnectionString = $env:SUPABASE_DB_URL,
  [string]$BackupPath = (Join-Path $PSScriptRoot 'db_cluster-16-12-2025@08-12-12.backup'),
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
  throw 'Provide -ConnectionString or set SUPABASE_DB_URL before running restore-backup.ps1.'
}

if (-not (Test-Path -LiteralPath $BackupPath)) {
  throw "Backup file not found: $BackupPath"
}

$psqlPath = Resolve-Psql $PsqlCommand

Write-Host "Using psql from: $psqlPath"
Write-Host "Restoring backup: $BackupPath"
Write-Host 'Expected: Supabase system objects may emit already-exists errors during restore.'

& $psqlPath $ConnectionString -f $BackupPath
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
  Write-Warning "psql exited with code $exitCode. Review the output carefully, then run validation."
  exit $exitCode
}

Write-Host 'Restore command completed.'
Write-Host 'Next step: run .\restore-supabase\run-validation.ps1'
