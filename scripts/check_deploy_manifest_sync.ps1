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

function Add-ContractFile {
    param(
        [string]$RelativePath,
        [ref]$ContractText,
        [System.Collections.Generic.List[string]]$Issues
    )
    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        return
    }
    $fullPath = if ([System.IO.Path]::IsPathRooted($RelativePath)) { $RelativePath } else { Join-Path $repoRoot $RelativePath }
    if (-not (Test-Path $fullPath)) {
        $Issues.Add("Production deploy contract file not found: $RelativePath")
        return
    }
    $ContractText.Value += "`n" + (Get-Content -Raw -Path $fullPath)
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
    Add-ContractFile -RelativePath $manifest.portableReleaseScript -ContractText ([ref]$deployContractText) -Issues $issues
    Add-ContractFile -RelativePath $manifest.portableVerifyScript -ContractText ([ref]$deployContractText) -Issues $issues
    Add-ContractFile -RelativePath $manifest.productionScopePlanner -ContractText ([ref]$deployContractText) -Issues $issues

    foreach ($requiredText in @(
        $manifest.workerName,
        $manifest.r2Bucket,
        $manifest.workerDirectory,
        $manifest.portableReleaseScript,
        $manifest.portableVerifyScript,
        $manifest.productionScopePlanner,
        "deploy:production:quick-preflight",
        "deploy:production:fast",
        "materialize:original-ui:dry-run",
        "materialize:original-ui",
        "CLOUDFLARE_API_TOKEN",
        "VPS SSH/deploy"
    )) {
        if (-not [string]::IsNullOrWhiteSpace($requiredText) -and $deployContractText -notmatch [regex]::Escape($requiredText)) {
            $issues.Add("Production deploy contract is missing text: $requiredText")
        }
    }

    foreach ($url in $manifest.healthChecks) {
        if ($deployContractText -notmatch [regex]::Escape($url)) {
            $issues.Add("Production verification contract is missing health check URL: $url")
        }
    }

    foreach ($workflowMarker in @(
        "paths:",
        "plan_production_release_scope.mjs",
        "deploy_required",
        "run_cloudflare_production_release.sh",
        "environment: production",
        "failure()",
        "retention-days: 3"
    )) {
        if ($workflowText -notmatch [regex]::Escape($workflowMarker)) {
            $issues.Add("deploy.yml is missing portable production workflow marker: $workflowMarker")
        }
    }

    if ($workflowText -match "cloudflare-production-preflight|actions/download-artifact") {
        $issues.Add("deploy.yml must not use the retired production preflight Artifact handoff")
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

    if ($manifest.triggerPolicy) {
        if (-not $manifest.triggerPolicy.mainPushOnly -or -not $manifest.triggerPolicy.pathFiltered -or -not $manifest.triggerPolicy.controlOnlySkipsMutation -or -not $manifest.triggerPolicy.exactShaRequired) {
            $issues.Add("Production trigger policy must require main push, path filtering, control-only mutation skip, and exact SHA verification")
        }
    } else {
        $issues.Add("Production deploy manifest is missing triggerPolicy")
    }

    if ($issues.Count -gt 0) {
        foreach ($issue in $issues) {
            Write-Error $issue
        }
        exit 1
    }

    Invoke-StagingManifestSyncCheck
    Write-Output "Portable Cloudflare production and staging deploy manifests are in sync."
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
        $deployScriptFullPath = if ([System.IO.Path]::IsPathRooted($v2.deployScriptPath)) { $v2.deployScriptPath } else { Join-Path $repoRoot $v2.deployScriptPath }
        if (Test-Path $deployScriptFullPath) {
            $deployContractText += "`n" + (Get-Content -Raw -Path $deployScriptFullPath)
        } else {
            $issues.Add("Production v2 blue/green deploy script not found: $($v2.deployScriptPath)")
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
