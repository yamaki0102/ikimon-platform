param(
    [string]$ManifestPath = "ops/deploy/deploy_manifest.json",
    [string]$WorkflowPath = ".github/workflows/deploy.yml"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestFullPath = if ([IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $repoRoot $ManifestPath }
$workflowFullPath = if ([IO.Path]::IsPathRooted($WorkflowPath)) { $WorkflowPath } else { Join-Path $repoRoot $WorkflowPath }

function Invoke-StagingManifestSyncCheck {
    $path = Join-Path $PSScriptRoot "check_staging_manifest_sync.ps1"
    if (-not (Test-Path $path)) { throw "Staging manifest checker not found: $path" }
    & pwsh -NoProfile -File $path
    if ($LASTEXITCODE -ne 0) { throw "Staging manifest sync check failed with exit code $LASTEXITCODE" }
}

function Resolve-ContractPath([string]$RelativePath) {
    if ([string]::IsNullOrWhiteSpace($RelativePath)) { return $null }
    if ([IO.Path]::IsPathRooted($RelativePath)) { return $RelativePath }
    return Join-Path $repoRoot $RelativePath
}

function Read-ContractFile {
    param([string]$RelativePath, [System.Collections.Generic.List[string]]$Issues)
    $path = Resolve-ContractPath $RelativePath
    if (-not $path -or -not (Test-Path $path)) {
        $Issues.Add("Production deploy contract file not found: $RelativePath")
        return ""
    }
    return Get-Content -Raw -Path $path
}

function Test-PowerShellFileParses {
    param([string]$RelativePath, [System.Collections.Generic.List[string]]$Issues)
    $path = Resolve-ContractPath $RelativePath
    if (-not $path -or -not (Test-Path $path)) {
        $Issues.Add("PowerShell contract file not found: $RelativePath")
        return
    }
    $tokens = $null
    $errors = $null
    [void][Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors)
    foreach ($error in @($errors)) {
        $Issues.Add("PowerShell parse error in ${RelativePath}: $($error.Message)")
    }
}

function Require-Text {
    param(
        [string]$Text,
        [object[]]$Markers,
        [string]$Prefix,
        [System.Collections.Generic.List[string]]$Issues
    )
    foreach ($markerValue in $Markers) {
        $marker = [string]$markerValue
        if (-not [string]::IsNullOrWhiteSpace($marker) -and $Text -notmatch [regex]::Escape($marker)) {
            $Issues.Add("${Prefix}: $marker")
        }
    }
}

if (-not (Test-Path $manifestFullPath)) { throw "Deploy manifest not found: $manifestFullPath" }
if (-not (Test-Path $workflowFullPath)) { throw "Deploy workflow not found: $workflowFullPath" }

$manifest = Get-Content -Raw -Path $manifestFullPath | ConvertFrom-Json
$workflowText = Get-Content -Raw -Path $workflowFullPath
$issues = New-Object System.Collections.Generic.List[string]

if ($manifest.platform -eq "cloudflare_worker") {
    $contractPaths = @(
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
    )
    $deployContractText = $workflowText
    foreach ($contractPath in $contractPaths) {
        $deployContractText += "`n" + (Read-ContractFile -RelativePath $contractPath -Issues $issues)
    }

    foreach ($path in @($manifest.verificationWindowsRunner, $manifest.verificationWindowsInstaller, $manifest.verificationWindowsDoctor)) {
        Test-PowerShellFileParses -RelativePath $path -Issues $issues
    }

    Require-Text -Text $deployContractText -Prefix "Production deploy contract is missing text" -Issues $issues -Markers @(
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
        'New-ScheduledTaskPrincipal -UserId "SYSTEM"',
        "RepetitionInterval (New-TimeSpan -Minutes 15)",
        "Wait-ScheduledTaskCompletion",
        "Convert-ToGitBashPath",
        "systemd-analyze verify",
        "--dry-run",
        "--uninstall",
        "CLOUDFLARE_API_TOKEN",
        "VPS SSH/deploy"
    )

    foreach ($url in $manifest.healthChecks) {
        if ($deployContractText -notmatch [regex]::Escape($url)) {
            $issues.Add("Production verification contract is missing health check URL: $url")
        }
    }

    Require-Text -Text $workflowText -Prefix "deploy.yml is missing portable production workflow marker" -Issues $issues -Markers @(
        "paths:",
        "plan_production_release_scope.mjs",
        "deploy_required",
        "run_cloudflare_production_release.sh",
        "publish_production_verification_status.mjs",
        "production_verification_operations.tests.mjs",
        "windows_production_verification_contract.tests.ps1",
        "release_automation.tests.ps1",
        "production-verification-latest.json",
        "statuses: write",
        "continue-on-error: true",
        "environment: production",
        "failure()",
        "retention-days: 3"
    )

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

    $trigger = $manifest.triggerPolicy
    if (-not $trigger -or -not $trigger.mainPushOnly -or -not $trigger.pathFiltered -or -not $trigger.controlOnlySkipsMutation -or -not $trigger.exactShaRequired -or -not $trigger.statusAggregationBestEffort) {
        $issues.Add("Production trigger policy must require main push, path filtering, control-only mutation skip, exact SHA verification, and best-effort status aggregation")
    }

    $operations = $manifest.verificationOperations
    if (-not $operations) {
        $issues.Add("Production deploy manifest is missing verificationOperations")
    } else {
        if ($operations.recommendedCadenceMinutes -ne 15 -or $operations.historicalRetentionDays -lt 1 -or -not $operations.installerPreservesExistingEnvironment -or $operations.installerAcceptsSecretsOnCommandLine -or -not $operations.timerEnableRequiresHostAccess) {
            $issues.Add("Linux verification operations must preserve the environment file, reject command-line secrets, retain evidence, and require host access")
        }
        if ($operations.windowsTaskPrincipal -ne "SYSTEM" -or -not $operations.windowsInstallerPreservesExistingEnvironment -or $operations.windowsInstallerAcceptsSecretsOnCommandLine -or -not $operations.windowsTaskEnableRequiresHostAccess -or -not $operations.windowsInitialSystemRunRequired) {
            $issues.Add("Windows verification operations must run as SYSTEM, preserve the environment file, reject command-line secrets, require host access, and validate the registered task")
        }
    }

    $policyPath = Resolve-ContractPath $manifest.verificationPolicyPath
    if (Test-Path $policyPath) {
        $policy = Get-Content -Raw -Path $policyPath | ConvertFrom-Json
        if ($policy.githubStatus.context -ne $manifest.verificationStatusContext) {
            $issues.Add("Production verification policy status context does not match deploy manifest")
        }
        if ($policy.safety.productionMutation -or -not $policy.safety.noDatabaseWrites -or -not $policy.safety.noR2Writes -or -not $policy.safety.noSecretMutation -or -not $policy.safety.noPersonalDataInReport -or -not $policy.safety.exactRuntimeShaBinding) {
            $issues.Add("Production verification policy must remain read-only, no-personal-data, and exact-SHA-bound")
        }
        if (-not $policy.windowsScheduledTask -or $policy.windowsScheduledTask.taskPrincipal -ne "SYSTEM" -or $policy.windowsScheduledTask.acceptSecretsOnCommandLine -or -not $policy.windowsScheduledTask.registeredSystemVerificationRequired -or -not $policy.safety.windowsEnvironmentAllowlist -or -not $policy.safety.windowsPrivateAcl) {
            $issues.Add("Production verification policy must define a private, allowlisted, SYSTEM-run Windows scheduled task with registered-task verification")
        }
    }

    $serviceText = Read-ContractFile -RelativePath $manifest.verificationSystemdService -Issues $issues
    if ($serviceText -match '(?m)^Environment=PUBLISH_GITHUB_STATUS=true$') {
        $issues.Add("Systemd service must not force GitHub status publishing without a configured token")
    }
    Require-Text -Text $serviceText -Prefix "Systemd verification service is missing hardening marker" -Issues $issues -Markers @("UMask=0077", "ProtectSystem=strict", "NoNewPrivileges=true", "PrivateDevices=true", "StateDirectoryMode=0750")

    $timerText = Read-ContractFile -RelativePath $manifest.verificationSystemdTimer -Issues $issues
    if ($timerText -notmatch [regex]::Escape("OnCalendar=*:0/15")) {
        $issues.Add("Systemd verification timer must run on a 15-minute calendar cadence")
    }

    foreach ($environmentPath in @($manifest.verificationEnvironmentExample, $manifest.verificationWindowsEnvironmentExample)) {
        $environmentText = Read-ContractFile -RelativePath $environmentPath -Issues $issues
        if ($environmentText -notmatch '(?m)^PUBLISH_GITHUB_STATUS=false$') {
            $issues.Add("Verification environment example must default GitHub status publishing to false: $environmentPath")
        }
        if ($environmentText -match '(?m)^(?:GITHUB_TOKEN|GH_TOKEN)=\S+') {
            $issues.Add("Verification environment example must not contain a token value: $environmentPath")
        }
    }

    $linuxInstaller = Read-ContractFile -RelativePath $manifest.verificationInstaller -Issues $issues
    if ($linuxInstaller -match '--(?:github|cloudflare)-token') {
        $issues.Add("Linux verification installer must not accept secrets on the command line")
    }
    if ($linuxInstaller -notmatch [regex]::Escape("Preserving existing environment file")) {
        $issues.Add("Linux verification installer must preserve an existing environment file")
    }

    $windowsInstaller = Read-ContractFile -RelativePath $manifest.verificationWindowsInstaller -Issues $issues
    Require-Text -Text $windowsInstaller -Prefix "Windows verification installer is missing safety marker" -Issues $issues -Markers @(
        'New-ScheduledTaskPrincipal -UserId "SYSTEM"',
        "RepetitionInterval (New-TimeSpan -Minutes 15)",
        "Preserving existing environment file",
        "Initial production verification failed",
        "Invoke-PowerShellChild",
        "Start-ScheduledTask",
        "Wait-ScheduledTaskCompletion"
    )
    if ($windowsInstaller -match '--(?:github|cloudflare)-token') {
        $issues.Add("Windows verification installer must not accept secrets on the command line")
    }

    $windowsRunner = Read-ContractFile -RelativePath $manifest.verificationWindowsRunner -Issues $issues
    Require-Text -Text $windowsRunner -Prefix "Windows verification runner is missing safety marker" -Issues $issues -Markers @("Import-SafeEnvironmentFile", "Convert-ToGitBashPath", "IKIMON_VERIFICATION_ARCHIVE_DIR", "Node.js 22+")

    $windowsDoctor = Read-ContractFile -RelativePath $manifest.verificationWindowsDoctor -Issues $issues
    Require-Text -Text $windowsDoctor -Prefix "Windows verification doctor is missing validation marker" -Issues $issues -Markers @("Test-PrivateAcl", "PT15M", "ServiceAccount", "noPersonalData", "productionMutation")

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
if ($workflowText -notmatch "check_deploy_guardrails\.ps1") {
    $issues.Add("deploy.yml is missing deploy guardrail check step")
}
if ($issues.Count -gt 0) {
    foreach ($issue in $issues) { Write-Error $issue }
    exit 1
}
Invoke-StagingManifestSyncCheck
Write-Output "Deploy manifests and workflows are in sync."
