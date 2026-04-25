param(
    [string]$ManifestPath = "ops/deploy/deploy_manifest.json",
    [string]$WorkflowPath = ".github/workflows/deploy.yml"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestFullPath = if ([System.IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $repoRoot $ManifestPath }
$workflowFullPath = if ([System.IO.Path]::IsPathRooted($WorkflowPath)) { $WorkflowPath } else { Join-Path $repoRoot $WorkflowPath }

if (-not (Test-Path $manifestFullPath)) {
    throw "Deploy manifest not found: $manifestFullPath"
}

if (-not (Test-Path $workflowFullPath)) {
    throw "Deploy workflow not found: $workflowFullPath"
}

$manifest = Get-Content -Raw -Path $manifestFullPath | ConvertFrom-Json
$workflowText = Get-Content -Raw -Path $workflowFullPath
$deployContractText = $workflowText
$issues = New-Object System.Collections.Generic.List[string]

if ($workflowText -notmatch [regex]::Escape($manifest.productionHost)) {
    $issues.Add("deploy.yml does not reference productionHost $($manifest.productionHost)")
}

$serverScriptPath = "$($manifest.productionRoot)/deploy.sh"
if ($workflowText -notmatch [regex]::Escape($serverScriptPath)) {
    $issues.Add("deploy.yml does not call expected server deploy script $serverScriptPath")
}

foreach ($url in $manifest.healthChecks) {
    if ($workflowText -notmatch [regex]::Escape($url)) {
        $issues.Add("deploy.yml verify step is missing health check URL: $url")
    }
}

if ($manifest.productionV2BlueGreen) {
    $v2 = $manifest.productionV2BlueGreen
    if ($v2.deployScriptPath) {
        $deployScriptFullPath = if ([System.IO.Path]::IsPathRooted($v2.deployScriptPath)) {
            $v2.deployScriptPath
        } else {
            Join-Path $repoRoot $v2.deployScriptPath
        }
        if (Test-Path $deployScriptFullPath) {
            $deployContractText += "`n" + (Get-Content -Raw -Path $deployScriptFullPath)
        } else {
            $issues.Add("Production v2 blue/green deploy script not found: $($v2.deployScriptPath)")
        }
    }

    foreach ($requiredText in @(
        $v2.blueServiceName,
        $v2.greenServiceName,
        $v2.legacyPm2Name,
        $v2.envFile,
        $v2.deployScriptPath,
        $v2.blueUnitReferencePath,
        $v2.greenUnitReferencePath,
        $v2.deployStateDirectory,
        "prepare",
        "promote",
        "CANDIDATE_PORT",
        "e2e:production-smoke",
        "npm ci",
        "npm run typecheck",
        "npm run build",
        "ssh -i"
    )) {
        if (-not [string]::IsNullOrWhiteSpace($requiredText) -and $deployContractText -notmatch [regex]::Escape($requiredText)) {
            $issues.Add("deploy.yml is missing production v2 blue/green deploy contract text: $requiredText")
        }
    }

    foreach ($path in @($manifest.v2InternalHealthChecks)) {
        if (-not [string]::IsNullOrWhiteSpace($path) -and $deployContractText -notmatch [regex]::Escape($path)) {
            $issues.Add("deploy.yml is missing production v2 internal health check path: $path")
        }
    }

    foreach ($root in @(
        $v2.legacyDataRoot,
        $v2.legacyPublicRoot,
        $v2.legacyUploadsRoot
    )) {
        if (-not [string]::IsNullOrWhiteSpace($root) -and $deployContractText -notmatch [regex]::Escape($root)) {
            $issues.Add("deploy.yml is missing production v2 legacy root: $root")
        }
    }
}

if ($workflowText -notmatch "check_deploy_guardrails\.ps1") {
    $issues.Add("deploy.yml is missing deploy guardrail check step")
}

if ($issues.Count -gt 0) {
    foreach ($issue in $issues) {
        Write-Error $issue
    }
    exit 1
}

Write-Output "Deploy manifest and workflow are in sync."
