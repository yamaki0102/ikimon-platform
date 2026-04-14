param(
    [string]$HostAlias = "ikimon-vps",
    [string]$RemoteRoot = "/var/www/ikimon.life",
    [string]$SnapshotRoot = "_archive/prod_state_snapshots",
    [switch]$IncludeUploadsArchive
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$snapshotDir = Join-Path $repoRoot $SnapshotRoot
$targetDir = Join-Path $snapshotDir $timestamp
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

function Invoke-Remote([string]$Command) {
    $result = & ssh $HostAlias $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Remote command failed: $Command"
    }
    return @($result | ForEach-Object { [string]$_ })
}

function Invoke-RemoteFirst([string]$Command) {
    $lines = Invoke-Remote $Command
    if ($lines.Count -eq 0) {
        return ""
    }
    return ([string]$lines[0]).Trim()
}

$latestDataArchive = Invoke-RemoteFirst "ls -1t $RemoteRoot/backups/data_*.tar.gz | head -n 1"
if (-not $latestDataArchive) {
    throw "Could not find production data archive under $RemoteRoot/backups"
}

$manifest = [ordered]@{
    captured_at = (Get-Date).ToString("o")
    host_alias = $HostAlias
    remote_root = $RemoteRoot
    app_commit = Invoke-RemoteFirst "cd $RemoteRoot/repo && git rev-parse HEAD"
    app_branch = Invoke-RemoteFirst "cd $RemoteRoot/repo && git branch --show-current"
    latest_data_archive = $latestDataArchive
    data_size = Invoke-RemoteFirst "du -sh $RemoteRoot/repo/upload_package/data | cut -f1"
    uploads_size = Invoke-RemoteFirst "du -sh $RemoteRoot/persistent/uploads | cut -f1"
    observation_files = (Invoke-RemoteFirst "find $RemoteRoot/repo/upload_package/data/observations -type f 2>/dev/null | wc -l").Trim()
    upload_files = (Invoke-RemoteFirst "find $RemoteRoot/persistent/uploads -type f 2>/dev/null | wc -l").Trim()
    top_level_data_dirs = Invoke-Remote "find $RemoteRoot/repo/upload_package/data -mindepth 1 -maxdepth 1 -type d | sort"
    recent_backups = Invoke-Remote "ls -1t $RemoteRoot/backups/data_*.tar.gz | head -n 5"
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $targetDir "prod_state_manifest.json") -Encoding UTF8

Push-Location $targetDir
try {
    $downloadCmdPath = Join-Path $targetDir "_download_data.cmd"
    Set-Content -Path $downloadCmdPath -Encoding ASCII -Value @(
        "@echo off",
        "scp ${HostAlias}:$latestDataArchive data_latest.tar.gz"
    )
    & cmd /c ".\_download_data.cmd"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to download production data archive"
    }
}
finally {
    Remove-Item -Path (Join-Path $targetDir "_download_data.cmd") -ErrorAction SilentlyContinue
    Pop-Location
}

Invoke-Remote "sed -n '1,240p' /etc/nginx/sites-available/ikimon.life" | Set-Content -Path (Join-Path $targetDir "nginx_ikimon.life.conf") -Encoding UTF8
Invoke-Remote "sed -n '1,240p' $RemoteRoot/deploy.sh" | Set-Content -Path (Join-Path $targetDir "remote_deploy.sh") -Encoding UTF8

if ($IncludeUploadsArchive) {
    $remoteUploadsArchive = "$RemoteRoot/backups/uploads_$timestamp.tar.gz"
    Invoke-Remote "tar czf $remoteUploadsArchive -C $RemoteRoot/persistent uploads"
    Push-Location $targetDir
    try {
        $downloadUploadsCmdPath = Join-Path $targetDir "_download_uploads.cmd"
        Set-Content -Path $downloadUploadsCmdPath -Encoding ASCII -Value @(
            "@echo off",
            "scp ${HostAlias}:$remoteUploadsArchive uploads_$timestamp.tar.gz"
        )
        & cmd /c ".\_download_uploads.cmd"
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to download production uploads archive"
        }
    }
    finally {
        Remove-Item -Path (Join-Path $targetDir "_download_uploads.cmd") -ErrorAction SilentlyContinue
        Pop-Location
    }
    Invoke-Remote "rm -f $remoteUploadsArchive" | Out-Null
}

Write-Output "Production state snapshot saved to: $targetDir"
