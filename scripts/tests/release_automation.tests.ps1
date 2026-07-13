$ErrorActionPreference = "Stop"

. (Join-Path (Split-Path -Parent $PSScriptRoot) "release_automation_lib.ps1")

$script:assertions = 0

function Assert-Equal {
    param($Actual, $Expected, [string]$Message)

    $script:assertions++
    if ($Actual -ne $Expected) {
        throw "$Message (expected='$Expected', actual='$Actual')"
    }
}

function Assert-Throws {
    param([scriptblock]$Script, [string]$Message)

    $script:assertions++
    try {
        & $Script
    }
    catch {
        return
    }
    throw $Message
}

function Assert-PowerShellParses {
    param([string]$Path, [string]$Message)

    $script:assertions++
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$tokens, [ref]$errors)
    if (@($errors).Count -gt 0) {
        $detail = (@($errors) | ForEach-Object { $_.Message }) -join "; "
        throw "$Message ($detail)"
    }
}

Assert-Equal (ConvertTo-ReleaseTaskName -TaskName "Deploy Autopilot 20260710") "deploy-autopilot-20260710" "Task names should normalize to safe branch slugs"
Assert-Throws { ConvertTo-ReleaseTaskName -TaskName "x" } "One-character task names must be rejected"
Assert-Throws { ConvertTo-ReleaseTaskName -TaskName "release/unsafe" } "Task names containing a slash must be rejected"
Assert-Equal (Get-RepositorySlug -RemoteUrl "https://github.com/yamaki0102/ikimon-platform.git") "yamaki0102/ikimon-platform" "HTTPS GitHub origins should resolve to owner/repo"
Assert-Equal (Get-RepositorySlug -RemoteUrl "git@github.com:yamaki0102/ikimon-platform.git") "yamaki0102/ikimon-platform" "SSH GitHub origins should resolve to owner/repo"

$readyRollup = @(
    [pscustomobject]@{ name = "Quality Gate"; status = "COMPLETED"; conclusion = "SUCCESS" },
    [pscustomobject]@{ name = "Record Funnel Browser QA"; status = "COMPLETED"; conclusion = "SKIPPED" },
    [pscustomobject]@{ context = "Ai Review Gate"; state = "SUCCESS" }
)
Assert-Equal (Get-RequiredChecksState -RequiredContexts @("Quality Gate", "Record Funnel Browser QA", "Ai Review Gate") -Rollup $readyRollup).state "ready" "Successful required checks should be ready"

$pendingRollup = @($readyRollup[0], $readyRollup[1], [pscustomobject]@{ name = "Ai Review Gate"; status = "IN_PROGRESS"; conclusion = $null })
Assert-Equal (Get-RequiredChecksState -RequiredContexts @("Quality Gate", "Record Funnel Browser QA", "Ai Review Gate") -Rollup $pendingRollup).state "pending" "In-progress required checks should be pending"

$failedRollup = @($readyRollup[0], $readyRollup[1], [pscustomobject]@{ name = "Ai Review Gate"; status = "COMPLETED"; conclusion = "FAILURE" })
Assert-Equal (Get-RequiredChecksState -RequiredContexts @("Quality Gate", "Record Funnel Browser QA", "Ai Review Gate") -Rollup $failedRollup).state "failed" "Failed required checks should block promotion"
Assert-Equal (Get-RequiredChecksState -RequiredContexts @("Quality Gate", "Missing Gate") -Rollup $readyRollup).state "pending" "Missing required checks should remain pending"

$duplicateRollup = @(
    [pscustomobject]@{ name = "Quality Gate"; status = "COMPLETED"; conclusion = "FAILURE"; completedAt = "2026-07-10T00:00:00Z" },
    [pscustomobject]@{ name = "Quality Gate"; status = "COMPLETED"; conclusion = "SUCCESS"; completedAt = "2026-07-10T00:05:00Z" }
)
Assert-Equal (Get-RequiredChecksState -RequiredContexts @("Quality Gate") -Rollup $duplicateRollup).state "ready" "The newest duplicate check run should determine promotion state"

Assert-Equal (Test-RequiresCloudflareStaging -ChangedPaths @("platform_v2/src/app.ts")) $true "Current app changes require Cloudflare staging"
Assert-Equal (Test-RequiresCloudflareStaging -ChangedPaths @("platform_v2/cloudflare_shadow/src/index.ts")) $true "Worker changes require Cloudflare staging"
Assert-Equal (Test-RequiresCloudflareStaging -ChangedPaths @("docs/DEPLOYMENT.md", "scripts/release_autopilot.ps1")) $false "Documentation and local release tooling do not require a staging deploy"

$shaA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
$shaB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
$runASuccess = [pscustomobject]@{ displayTitle = "Cloudflare staging | branch=codex/a | target=$shaA"; status = "completed"; conclusion = "success"; createdAt = "2026-07-10T00:00:00Z" }
$runARunning = [pscustomobject]@{ displayTitle = "Cloudflare staging | branch=codex/a | target=$shaA"; status = "in_progress"; conclusion = $null; createdAt = "2026-07-10T00:05:00Z" }
$runAFailed = [pscustomobject]@{ displayTitle = "Cloudflare staging | branch=codex/a | target=$shaA"; status = "completed"; conclusion = "failure"; createdAt = "2026-07-10T00:05:00Z" }
$runBSuccess = [pscustomobject]@{ displayTitle = "Cloudflare staging | branch=codex/b | target=$shaB"; status = "completed"; conclusion = "success"; createdAt = "2026-07-10T00:10:00Z" }
Assert-Equal (Get-StagingRunDecision -Runs @() -TargetSha $shaA).action "dispatch" "A candidate with no staging history should dispatch"
Assert-Equal (Get-StagingRunDecision -Runs @($runASuccess) -TargetSha $shaA).action "reuse" "The current successful staging SHA should be reused"
Assert-Equal (Get-StagingRunDecision -Runs @($runASuccess, $runARunning) -TargetSha $shaA).action "wait" "A resumed release should wait for its current staging run"
Assert-Equal (Get-StagingRunDecision -Runs @($runAFailed) -TargetSha $shaA).action "block" "A current failed staging run should require an explicit retry"
Assert-Equal (Get-StagingRunDecision -Runs @($runAFailed) -TargetSha $shaA -RetryFailed).action "dispatch" "An explicit retry should dispatch after a failed staging run"
Assert-Equal (Get-StagingRunDecision -Runs @($runASuccess, $runBSuccess) -TargetSha $shaA).action "dispatch" "A candidate overwritten by a newer staging SHA must be redeployed"

$cleanScan = Test-AddedLinesForSecrets -DiffLines @("+const token = process.env.GITHUB_TOKEN;", "+VPS_SSH_KEY: `${{ secrets.VPS_SSH_KEY }}")
Assert-Equal @($cleanScan).Count 0 "Environment variable references must not be treated as leaked secrets"

$fakeGitHubToken = "gh" + "p_" + "abcdefghijklmnopqrstuvwxyz1234567890AB"
$leakedScan = Test-AddedLinesForSecrets -DiffLines @("+++ b/example.txt", "+token=$fakeGitHubToken")
Assert-Equal @($leakedScan).Count 1 "A GitHub token literal must be detected"
Assert-Equal $leakedScan[0].kind "github-token" "Secret scan should classify the token without echoing it"

$repoRoot = (Resolve-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))).Path
$removedDeployWorkflows = @("deploy.yml", "deploy-staging.yml", "deploy-cloudflare-staging.yml", "cloudflare-quick-preflight.yml", "cloudflare-shadow-release.yml")
foreach ($workflow in $removedDeployWorkflows) {
    Assert-Equal (Test-Path (Join-Path $repoRoot ".github/workflows/$workflow")) $false "Deploy workflow must be removed: $workflow"
}
$deployManifest = Get-Content -Raw (Join-Path $repoRoot "ops/deploy/deploy_manifest.json") | ConvertFrom-Json
Assert-Equal $deployManifest.triggerPolicy.commandBusOnly $true "Cloudflare command bus must be the only normal deploy trigger"
Assert-Equal $deployManifest.githubActionsDependency.required $false "GitHub Actions must not be required"
Assert-Equal $deployManifest.githubActionsDependency.executionBackend $false "GitHub Actions must not be an execution backend"
Assert-Equal $deployManifest.executionLanes.primary.id "cloudflare_executor" "Cloudflare Executor must own normal execution"

$worktreeScript = Get-Content -Raw (Join-Path $repoRoot "scripts/new_release_worktree.ps1")
$candidateScript = Get-Content -Raw (Join-Path $repoRoot "scripts/check_release_candidate.ps1")
Assert-Equal ([bool]($worktreeScript -match '\$nativeExitCode = \$LASTEXITCODE')) $true "Worktree creation must not treat normal git stderr progress as failure"
Assert-Equal ([bool]($candidateScript -match '\$nativeExitCode = \$LASTEXITCODE')) $true "Candidate checks must decide gh success from its exit code"

$windowsRunnerPath = Join-Path $repoRoot "scripts/Invoke-ProductionVerificationWatch.ps1"
$windowsInstallerPath = Join-Path $repoRoot "scripts/Install-ProductionVerificationScheduledTask.ps1"
$windowsDoctorPath = Join-Path $repoRoot "scripts/Test-ProductionVerificationWindows.ps1"
Assert-PowerShellParses -Path $windowsRunnerPath -Message "Windows verification runner must parse"
Assert-PowerShellParses -Path $windowsInstallerPath -Message "Windows scheduled task installer must parse"
Assert-PowerShellParses -Path $windowsDoctorPath -Message "Windows verification doctor must parse"
$windowsInstaller = Get-Content -Raw $windowsInstallerPath
$windowsRunner = Get-Content -Raw $windowsRunnerPath
$windowsDoctor = Get-Content -Raw $windowsDoctorPath
Assert-Equal ([bool]($windowsInstaller -match 'New-ScheduledTaskPrincipal -UserId "SYSTEM"')) $true "Windows task must run as SYSTEM"
Assert-Equal ([bool]($windowsInstaller -match 'RepetitionInterval \(New-TimeSpan -Minutes 15\)')) $true "Windows task must run every 15 minutes"
Assert-Equal ([bool]($windowsInstaller -match 'Preserving existing environment file')) $true "Windows installer must preserve the existing secret file"
Assert-Equal ([bool]($windowsInstaller -match 'Initial production verification failed.+scheduled task was not installed')) $true "Windows task registration must require a successful direct verification"
Assert-Equal ([bool]($windowsInstaller -match 'Invoke-PowerShellChild')) $true "Windows installer must isolate child scripts that call exit"
Assert-Equal ([bool]($windowsInstaller -match 'RemoveAccessRuleSpecific')) $true "Windows ACL setup must remove every previous explicit access rule"
Assert-Equal ([bool]($windowsInstaller -match 'Test-ExactPrivateAcl')) $true "Windows installer must verify the final exact ACL"
Assert-Equal ([bool]($windowsInstaller -match 'S-1-5-18')) $true "Windows state and secret ACLs must grant SYSTEM explicitly"
Assert-Equal ([bool]($windowsInstaller -match 'S-1-5-32-544')) $true "Windows state and secret ACLs must grant Administrators explicitly"
Assert-Equal ([bool]($windowsInstaller -match '--(?:github|cloudflare)-token')) $false "Windows installer must not accept token command-line options"
Assert-Equal ([bool]($windowsRunner -match 'Import-SafeEnvironmentFile')) $true "Windows runner must parse a restricted environment allowlist"
Assert-Equal ([bool]($windowsRunner -match 'IKIMON_VERIFICATION_ARCHIVE_DIR')) $true "Windows runner must use the shared evidence archive"
Assert-Equal ([bool]($windowsDoctor -match 'Test-ExactPrivateAcl')) $true "Windows doctor must require exactly SYSTEM and Administrators ACLs"
Assert-Equal ([bool]($windowsDoctor -match 'rules.Count -ne 2')) $true "Windows doctor must reject additional concrete ACL principals"
Assert-Equal ([bool]($windowsDoctor -match 'PT15M')) $true "Windows doctor must verify the 15-minute task interval"

Write-Output "release automation tests passed: $script:assertions assertions"
