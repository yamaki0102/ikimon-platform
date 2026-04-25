param(
    [string]$ManifestPath = "docs/catchup_manifest.json",
    [switch]$WarningOnly
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

    $issues = New-Object System.Collections.Generic.List[string]

    if ($expectedSnapshot -ne $actualSnapshot) {
        $issues.Add("docs/CATCHUP_SNAPSHOT.md is out of date. Regenerate it with scripts/generate_catchup_snapshot.ps1.")
    }

    if ($expectedWorkspace -ne $actualWorkspace) {
        $issues.Add("ikimon.life.code-workspace is out of date. Regenerate it with scripts/generate_workspace_from_manifest.ps1.")
    }

    if ($issues.Count -gt 0) {
        foreach ($issue in $issues) {
            if ($WarningOnly) {
                Write-Warning $issue
            } else {
                Write-Error $issue
            }
        }

        if ($WarningOnly) {
            Write-Warning "Catch-up asset drift is non-blocking in CI. Refresh before handoff when the snapshot itself matters."
            exit 0
        }

        exit 1
    }

    Write-Output "Catch-up assets are in sync."
}
finally {
    if (Test-Path $tempDir) {
        Remove-Item -Recurse -Force -LiteralPath $tempDir
    }
}
