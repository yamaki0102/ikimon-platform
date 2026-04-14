param(
    [string]$HostAlias = "ikimon-vps",
    [string]$RemotePath = "/var/www/ikimon.life/deploy.sh",
    [string]$ReferencePath = "ops/deploy/production_deploy_reference.sh"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$referenceFullPath = if ([System.IO.Path]::IsPathRooted($ReferencePath)) { $ReferencePath } else { Join-Path $repoRoot $ReferencePath }

if (-not (Test-Path $referenceFullPath)) {
    throw "Reference deploy script not found: $referenceFullPath"
}

$localContent = ((Get-Content -Raw -Path $referenceFullPath) -replace "`r`n", "`n").TrimEnd("`n")
$remoteContent = & ssh $HostAlias "cat $RemotePath"

if ($LASTEXITCODE -ne 0) {
    throw "Failed to read remote deploy script via ssh alias '$HostAlias'"
}

$remoteContent = (($remoteContent -join "`n") -replace "`r`n", "`n").TrimEnd("`n")

if ($localContent -ne $remoteContent) {
    Write-Error "Remote deploy script differs from local reference: $RemotePath"
    exit 1
}

Write-Output "Remote deploy script matches local reference."
