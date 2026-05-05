param(
    [string]$ManifestPath = "docs/catchup_manifest.json",
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestFullPath = if ([System.IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $repoRoot $ManifestPath }

if (-not (Test-Path $manifestFullPath)) {
    throw "Manifest not found: $manifestFullPath"
}

$manifest = Get-Content -Raw -Path $manifestFullPath | ConvertFrom-Json

if (-not $manifest.workspace) {
    throw "Manifest is missing workspace configuration"
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = $manifest.workspace.file
}

$workspaceFullPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $repoRoot $OutputPath }
$workspaceObject = [ordered]@{
    folders = @($manifest.workspace.folders)
    settings = $manifest.workspace.settings
}

$workspaceJson = ($workspaceObject | ConvertTo-Json -Depth 20) -replace "`r`n", "`n"
$encoding = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($workspaceFullPath, $workspaceJson + "`n", $encoding)
Write-Output "Generated $workspaceFullPath"
