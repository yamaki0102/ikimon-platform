param(
    [string]$ManifestPath = "ops/deploy/staging_manifest.json",
    [string]$WorkflowPath = ".github/workflows/deploy-staging.yml"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestFullPath = if ([System.IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $repoRoot $ManifestPath }
$workflowFullPath = if ([System.IO.Path]::IsPathRooted($WorkflowPath)) { $WorkflowPath } else { Join-Path $repoRoot $WorkflowPath }

if (-not (Test-Path $manifestFullPath)) {
    throw "Staging manifest not found: $manifestFullPath"
}

if (-not (Test-Path $workflowFullPath)) {
    throw "Staging workflow not found: $workflowFullPath"
}

$manifest = Get-Content -Raw -Path $manifestFullPath | ConvertFrom-Json
$workflowText = Get-Content -Raw -Path $workflowFullPath
$issues = New-Object System.Collections.Generic.List[string]

if ($workflowText -notmatch [regex]::Escape($manifest.stagingRoot)) {
    $issues.Add("deploy-staging.yml does not reference stagingRoot $($manifest.stagingRoot)")
}

foreach ($url in $manifest.healthChecks) {
    if ($workflowText -notmatch [regex]::Escape($url)) {
        $issues.Add("deploy-staging.yml verify step is missing health check URL: $url")
    }
}

if ($issues.Count -gt 0) {
    foreach ($issue in $issues) {
        Write-Error $issue
    }
    exit 1
}

Write-Output "Staging manifest and workflow are in sync."
