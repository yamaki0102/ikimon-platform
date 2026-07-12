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
    if ([string]::IsNullOrWhiteSpace($RelativePath)) { return }
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

function Test-PowerShellFileParses {
    param([string]$RelativePath, [System.Collections.Generic.List[string]]$Issues)
    if ([string]::IsNullOrWhiteSpace($RelativePath)) { return }
    $fullPath = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path $fullPath)) {
        $Issues.Add("PowerShell contract file not found: $RelativePath")
        return
    }
    $tokens = $null
    $parseErrors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($fullPath, [ref]$tokens, [ref]$parseErrors)
    foreach ($parseError in @($parseErrors)) {
        $Issues.Add("PowerShell parse error in ${RelativePath}: $($parseError.Message)")
    }
}

if (-not (Test-Path $manifestFullPath)) { throw "Deploy manifest not found: $manifestFullPath" }
if (-not (Test-Path $workflowFullPath)) { throw "Deploy workflow not found: $workflowFullPath" }

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
        $manifest.verificationWindowsRunner,
        $manifest.verificationWindowsInstaller,
        $manifest.verificationWindowsDoctor,
        $manifest.verificationPolicyPath,
        $manifest.verificationSystemdService,
        $manifest.verificationSystemdTimer,
        $manifest.verificationEnvironmentExample,
        $manifest.verificationWindowsEnvironmentExample,
        $manifest.productionScopePlanner
    )) {
        Add-ContractFile -RelativePath $contractPath -ContractText ([ref]$deployContractText) -Issues $issues
    }

    foreach ($powerShellPath in @(
        $manifest.verificationWindowsRunner,
        $manifest.verificationWindowsInstaller,
        $manifest.verificationWindowsDoctor
    )) {
        Test-PowerShellFileParses -RelativePath $powerShellPath -Issues $issues
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
        $manifest.verificationWindowsRunner,
        $manifest.verificationWindowsInstaller,
        $manifest.verificationWindowsDoctor,
        $manifest.verificationPolicyPath,
        $manifest.verificationSystemdService,
        $manifest.verificationSystemdTimer,
        $manifest.verificationEnvironmentExample,
        $manifest.verificationWindowsEnvironmentExample,
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
        "New-ScheduledTaskPrincipal -UserId \"SYSTEM\"",
        "RepetitionInterval (New-TimeSpan -Minutes 15)",
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
        "release_automation.tests.ps1",
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
        $operations = $manifest.verificationOperations
        if ($operations.recommendedCadenceMinutes -ne 15 -or $operations.historicalRetentionDays -lt 1 -or -not $operations.installerPreservesExistingEnvironment -or $operations.installerAcceptsSecretsOnCommandLine -or -not $operations.timerEnableRequiresHostAccess) {
            $issues.Add("Linux verification operations must preserve the environment file, reject command-line secrets, retain evidence, and require host access")
        }
        if ($operations.windowsTaskPrincipal -ne "SYSTEM" -or -not $operations.windowsInstallerPreservesExistingEnvironment -or $operations.windowsInstallerAcceptsSecretsOnCommandLine -or -not $operations.windowsTaskEnableRequiresHostAccess -or -not $operations.windowsInitialSystemRunRequired) {
            $issues.Add("Windows verification operations must run as SYSTEM, preserve the environment file, reject command-line secrets, require host access, and validate the registered task")
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
        if (-not $verificationPolicy.windowsScheduledTask -or $verificationPolicy.windowsScheduledTask.taskPrincipal -ne "SYSTEM" -or $verificationPolicy.windowsScheduledTask.acceptSecretsOnCommandLine -or -not $verificationPolicy.windowsScheduledTask.registeredSystemVerificationRequired -or -not $verificationPolicy.safety.windowsEnvironmentAllowlist -or -not $verificationPolicy.safety.windowsPrivateAcl) {
            $issues.Add("Production verification policy must define a private, allowlisted, SYSTEM-run Windows scheduled task with direct registered-task verification")
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

    foreach ($environmentPath in @($manifest.verificationEnvironmentExample, $manifest.verificationWindowsEnvironmentExample)) {
        $environmentText = Read-ContractFile -RelativePath $environmentPath
        if ($environmentText -notmatch '(?m)^PUBLISH_GITHUB_STATUS=false$') {
            $issues.Add("Verification environment example must default GitHub status publishing to false: $environmentPath")
        }
        if ($environmentText -match '(?m)^(?:GITHUB_TOKEN|GH_TOKEN)=\S+') {
            $issues.Add("Verification environment example must not contain a token value: $environmentPath")
        }
    }

    $installerText = Read-ContractFile -RelativePath $manifest.verificationInstaller
    if ($installerText -match '--(?:github|cloudflare)-token') {
        $issues.Add("Linux verification installer must not accept secrets on the command line")
    }
    if ($installerText -notmatch [regex]::Escape("Preserving existing environment file")) {
        $issues.Add("Linux verification installer must preserve an existing environment file")
    }

    $windowsInstallerText = Read-ContractFile -RelativePath $manifest.verificationWindowsInstaller
    foreach ($windowsInstallerMarker in @(
        'New-ScheduledTaskPrincipal -UserId "SYSTEM"',
        'RepetitionInterval (New-TimeSpan -Minutes 15)',
        'Preserving existing environment file',
        'Initial production verification failed',
        'Invoke-PowerShellChild',
        'Start-ScheduledTask'
    )) {
        if ($windowsInstallerText -notmatch [regex]::Escape($windowsInstallerMarker)) {
            $issues.Add("Windows verification installer is missing safety marker: $windowsInstallerMarker")
        }
    }
    if ($windowsInstallerText -match '--(?:github|cloudflare)-token') {
        $issues.Add("Windows verification installer must not accept secrets on the command line")
    }

    $windowsRunnerText = Read-ContractFile -RelativePath $manifest.verificationWindowsRunner
    foreach ($windowsRunnerMarker in @("Import-SafeEnvironmentFile", "IKIMON_VERIFICATION_ARCHIVE_DIR", "Node.js 22+")) {
        if ($windowsRunnerText -notmatch [regex]::Escape($windowsRunnerMarker)) {
            $issues.Add("Windows verification runner is missing safety marker: $windowsRunnerMarker")
        }
    }

    $windowsDoctorText = Read-ContractFile -RelativePath $manifest.verificationWindowsDoctor
    foreach ($windowsDoctorMarker in @("Test-PrivateAcl", "PT15M", "noPersonalData", "productionMutation")) {
        if ($windowsDoctorText -notmatch [regex]::Escape($windowsDoctorMarker)) {
            $issues.Add("Windows verification doctor is missing validation marker: $windowsDoctorMarker")
        }
    }

    if ($issues.Count -gt 0) {
        foreach ($issue in $issues) { Write-Error $issue }
        exit 1
    }

    Invoke-StagingManifestSyncCheck
    Write-Output "Portable Cloudflare production, Linux/Windows external verification operations, and staging deploy manifests are in sync."
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
    foreach ($issue in $issues) { Write-Error $issue }
    exit 1
}

Invoke-StagingManifestSyncCheck
Write-Output "Deploy manifests and workflows are in sync."
