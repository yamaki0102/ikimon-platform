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

function Read-ContractFile {
    param([string]$RelativePath)
    if ([string]::IsNullOrWhiteSpace($RelativePath)) { return "" }
    $fullPath = if ([System.IO.Path]::IsPathRooted($RelativePath)) { $RelativePath } else { Join-Path $repoRoot $RelativePath }
    if (-not (Test-Path $fullPath)) { return "" }
    return Get-Content -Raw -Path $fullPath
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
    foreach ($contractPath in @(
        $manifest.portableReleaseScript,
        $manifest.portableVerifyScript,
        $manifest.verificationWatchScript,
        $manifest.verificationReportBuilder,
        $manifest.verificationArchiveScript,
        $manifest.verificationStatusPublisher,
        $manifest.verificationInstaller,
        $manifest.verificationDoctor,
        $manifest.verificationPolicyPath,
        $manifest.verificationSystemdService,
        $manifest.verificationSystemdTimer,
        $manifest.verificationEnvironmentExample,
        $manifest.productionScopePlanner
    )) {
        Add-ContractFile -RelativePath $contractPath -ContractText ([ref]$deployContractText) -Issues $issues
    }

    foreach ($requiredText in @(
        $manifest.workerName,
        $manifest.r2Bucket,
        $manifest.workerDirectory,
        $manifest.portableReleaseScript,
        $manifest.portableVerifyScript,
        $manifest.verificationWatchScript,
        $manifest.verificationReportBuilder,
        $manifest.verificationArchiveScript,
        $manifest.verificationStatusPublisher,
        $manifest.verificationInstaller,
        $manifest.verificationDoctor,
        $manifest.verificationPolicyPath,
        $manifest.verificationSystemdService,
        $manifest.verificationSystemdTimer,
        $manifest.verificationEnvironmentExample,
        $manifest.verificationStatusContext,
        $manifest.productionScopePlanner,
        "ikimon_production_verification/v1",
        "ikimon_production_verification_archive_pointer/v1",
        "deploy:production:quick-preflight",
        "deploy:production:fast",
        "materialize:original-ui:dry-run",
        "materialize:original-ui",
        "StateDirectory=ikimon-production-verification",
        "IKIMON_VERIFICATION_ARCHIVE_RETENTION_DAYS=14",
        "systemd-analyze verify",
        "--dry-run",
        "--uninstall",
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
        "publish_production_verification_status.mjs",
        "production_verification_operations.tests.mjs",
        "production-verification-latest.json",
        "statuses: write",
        "continue-on-error: true",
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
        if (-not $manifest.triggerPolicy.mainPushOnly -or -not $manifest.triggerPolicy.pathFiltered -or -not $manifest.triggerPolicy.controlOnlySkipsMutation -or -not $manifest.triggerPolicy.exactShaRequired -or -not $manifest.triggerPolicy.statusAggregationBestEffort) {
            $issues.Add("Production trigger policy must require main push, path filtering, control-only mutation skip, exact SHA verification, and best-effort status aggregation")
        }
    } else {
        $issues.Add("Production deploy manifest is missing triggerPolicy")
    }

    if ($manifest.verificationOperations) {
        if ($manifest.verificationOperations.recommendedCadenceMinutes -ne 15 -or $manifest.verificationOperations.historicalRetentionDays -lt 1 -or -not $manifest.verificationOperations.installerPreservesExistingEnvironment -or $manifest.verificationOperations.installerAcceptsSecretsOnCommandLine -or -not $manifest.verificationOperations.timerEnableRequiresHostAccess) {
            $issues.Add("Production verification operations must preserve the environment file, reject command-line secrets, retain evidence, and require host access for timer enablement")
        }
    } else {
        $issues.Add("Production deploy manifest is missing verificationOperations")
    }

    $verificationPolicyFullPath = Join-Path $repoRoot $manifest.verificationPolicyPath
    if (Test-Path $verificationPolicyFullPath) {
        $verificationPolicy = Get-Content -Raw -Path $verificationPolicyFullPath | ConvertFrom-Json
        if ($verificationPolicy.githubStatus.context -ne $manifest.verificationStatusContext) {
            $issues.Add("Production verification policy status context does not match deploy manifest")
        }
        if ($verificationPolicy.safety.productionMutation -or -not $verificationPolicy.safety.noDatabaseWrites -or -not $verificationPolicy.safety.noR2Writes -or -not $verificationPolicy.safety.noSecretMutation -or -not $verificationPolicy.safety.noPersonalDataInReport -or -not $verificationPolicy.safety.exactRuntimeShaBinding) {
            $issues.Add("Production verification policy must remain read-only, no-personal-data, and exact-SHA-bound")
        }
    }

    $serviceText = Read-ContractFile -RelativePath $manifest.verificationSystemdService
    if ($serviceText -match '(?m)^Environment=PUBLISH_GITHUB_STATUS=true$') {
        $issues.Add("Systemd service must not force GitHub status publishing without a configured token")
    }
    foreach ($serviceMarker in @("UMask=0077", "ProtectSystem=strict", "NoNewPrivileges=true", "PrivateDevices=true", "StateDirectoryMode=0750")) {
        if ($serviceText -notmatch [regex]::Escape($serviceMarker)) {
            $issues.Add("Systemd verification service is missing hardening marker: $serviceMarker")
        }
    }

    $timerText = Read-ContractFile -RelativePath $manifest.verificationSystemdTimer
    if ($timerText -notmatch [regex]::Escape("OnCalendar=*:0/15")) {
        $issues.Add("Systemd verification timer must run on a 15-minute calendar cadence")
    }

    $environmentExampleText = Read-ContractFile -RelativePath $manifest.verificationEnvironmentExample
    if ($environmentExampleText -notmatch '(?m)^PUBLISH_GITHUB_STATUS=false$') {
        $issues.Add("Verification environment example must default GitHub status publishing to false")
    }
    if ($environmentExampleText -match '(?m)^(?:GITHUB_TOKEN|GH_TOKEN)=\S+') {
        $issues.Add("Verification environment example must not contain a token value")
    }

    $installerText = Read-ContractFile -RelativePath $manifest.verificationInstaller
    if ($installerText -match '--(?:github|cloudflare)-token') {
        $issues.Add("Verification installer must not accept secrets on the command line")
    }
    if ($installerText -notmatch [regex]::Escape("Preserving existing environment file")) {
        $issues.Add("Verification installer must preserve an existing environment file")
    }

    if ($issues.Count -gt 0) {
        foreach ($issue in $issues) {
            Write-Error $issue
        }
        exit 1
    }

    Invoke-StagingManifestSyncCheck
    Write-Output "Portable Cloudflare production, external verification, installation operations, and staging deploy manifests are in sync."
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
