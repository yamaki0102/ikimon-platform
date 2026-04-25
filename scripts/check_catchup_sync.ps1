param(
    [string]$ManifestPath = "docs/catchup_manifest.json"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("ikimon_catchup_check_" + [System.Guid]::NewGuid().ToString("N"))

if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force -LiteralPath $tempDir
}

New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    $snapshotGeneratedPath = Join-Path $tempDir "CATCHUP_SNAPSHOT.generated.md"
    $workspaceGeneratedPath = Join-Path $tempDir "ikimon.life.generated.code-workspace"

    & (Join-Path $PSScriptRoot "generate_catchup_snapshot.ps1") -ManifestPath $ManifestPath -OutputPath $snapshotGeneratedPath | Out-Null
    & (Join-Path $PSScriptRoot "generate_workspace_from_manifest.ps1") -ManifestPath $ManifestPath -OutputPath $workspaceGeneratedPath | Out-Null

    $expectedSnapshot = Get-Content -Raw -Path (Join-Path $repoRoot "docs/CATCHUP_SNAPSHOT.md")
    $actualSnapshot = Get-Content -Raw -Path $snapshotGeneratedPath
    $expectedWorkspace = Get-Content -Raw -Path (Join-Path $repoRoot "ikimon.life.code-workspace")
    $actualWorkspace = Get-Content -Raw -Path $workspaceGeneratedPath

    $hasDiff = $false

    if ($expectedSnapshot -ne $actualSnapshot) {
        Write-Error "docs/CATCHUP_SNAPSHOT.md is out of date. Regenerate it with scripts/generate_catchup_snapshot.ps1."
        $hasDiff = $true
    }

    if ($expectedWorkspace -ne $actualWorkspace) {
        Write-Error "ikimon.life.code-workspace is out of date. Regenerate it with scripts/generate_workspace_from_manifest.ps1."
        $hasDiff = $true
    }

    if ($hasDiff) {
        exit 1
    }

    Write-Output "Catch-up assets are in sync."
}
finally {
    if (Test-Path $tempDir) {
        Remove-Item -Recurse -Force -LiteralPath $tempDir
    }
}
