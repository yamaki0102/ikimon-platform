param(
    [string]$ManifestPath = "ops/deploy/deploy_manifest.json",
    [string]$WorkflowPath = ".github/workflows/deploy.yml"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestFullPath = if ([System.IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $repoRoot $ManifestPath }
$workflowFullPath = if ([System.IO.Path]::IsPathRooted($WorkflowPath)) { $WorkflowPath } else { Join-Path $repoRoot $WorkflowPath }

function Invoke-StagingManifestSyncCheck {
    $stagingCheckPath = Join-Path $PSScriptRoot "check_staging_manifest_sync.ps1"
    if (-not (Test-Path $stagingCheckPath)) {
        throw "Staging manifest checker not found: $stagingCheckPath"
    }
    & pwsh -NoProfile -File $stagingCheckPath
    if ($LASTEXITCODE -ne 0) {
        throw "Staging manifest sync check failed with exit code $LASTEXITCODE"
    }
}

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

if ($manifest.platform -eq "cloudflare_worker") {
    foreach ($requiredText in @(
        $manifest.workerName,
        $manifest.r2Bucket,
        $manifest.workerDirectory,
        "deploy:production:dry-run",
        "deploy:production",
        "materialize:original-ui:dry-run",
        "materialize:original-ui",
        "CLOUDFLARE_API_TOKEN",
        "VPS SSH/deploy"
    )) {
        if (-not [string]::IsNullOrWhiteSpace($requiredText) -and $workflowText -notmatch [regex]::Escape($requiredText)) {
            $issues.Add("deploy.yml is missing Cloudflare deploy contract text: $requiredText")
        }
    }

    foreach ($url in $manifest.healthChecks) {
        if ($workflowText -notmatch [regex]::Escape($url)) {
            $issues.Add("deploy.yml verify step is missing health check URL: $url")
        }
    }

    if ($workflowText -match "VPS_SSH_KEY|ssh -i|deploy_platform_v2_blue_green\.sh|162\.43\.44\.131") {
        $issues.Add("deploy.yml still references the old VPS production lane")
    }

    if ($workflowText -notmatch "check_deploy_guardrails\.ps1") {
        $issues.Add("deploy.yml is missing deploy guardrail check step")
    }

    if ($workflowText -match '(?m)^\s{2}workflow_dispatch:') {
        $issues.Add("deploy.yml must not expose workflow_dispatch; production deploy is main-push only")
    }

    if ($issues.Count -gt 0) {
        foreach ($issue in $issues) {
            Write-Error $issue
        }
        exit 1
    }

    Invoke-StagingManifestSyncCheck
    Write-Output "Cloudflare deploy manifests and workflows are in sync."
    exit 0
}

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

Invoke-StagingManifestSyncCheck
Write-Output "Deploy manifests and workflows are in sync."
