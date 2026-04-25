param(
    [string]$SshHost = "root@162.43.44.131",
    [string]$SshKey = (Join-Path $env:USERPROFILE ".ssh\ikimon_vps.pem"),
    [string]$RemoteBackupRoot = "/var/backups/ikimon.life",
    [string]$Stamp = (Get-Date -Format "yyyyMMdd-HHmmss"),
    [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

function Invoke-RemoteBash {
    param(
        [string]$Script,
        [switch]$SyntaxOnly
    )

    $sshArgs = @()
    if ($SshKey -and (Test-Path $SshKey)) {
        $sshArgs += @("-i", $SshKey)
    }
    $sshArgs += @($SshHost, $(if ($SyntaxOnly) { "bash -n" } else { "bash" }))

    ($Script -replace "`r`n", "`n" -replace "`r", "`n") | & ssh @sshArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Remote backup command failed with exit code $LASTEXITCODE"
    }
}

$remoteScript = @"
set -euo pipefail

backup_dir="${RemoteBackupRoot}/pre-deploy-${Stamp}"
legacy_data="/var/www/ikimon.life/repo/upload_package/data"

mkdir -p "`$backup_dir"

echo "== postgres dump =="
sudo -u postgres pg_dump -Fc ikimon_v2 > "`$backup_dir/ikimon_v2.dump"
sudo -u postgres pg_dump --schema-only ikimon_v2 > "`$backup_dir/ikimon_v2.schema.sql"

echo "== legacy auth/runtime snapshots =="
for file_name in users.json auth_tokens.json fieldscan_oauth_states.json; do
  if [ -f "`$legacy_data/`$file_name" ]; then
    cp -a "`$legacy_data/`$file_name" "`$backup_dir/`$file_name"
  fi
done

echo "== checksums =="
(cd "`$backup_dir" && sha256sum * > SHA256SUMS)

echo "backup_dir=`$backup_dir"
find "`$backup_dir" -maxdepth 1 -type f -printf "%f %s bytes\n" | sort
"@

Invoke-RemoteBash -Script $remoteScript -SyntaxOnly:$ValidateOnly
if ($ValidateOnly) {
    Write-Host "Production backup script syntax is valid."
}
