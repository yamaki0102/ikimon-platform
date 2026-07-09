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
$stagingWorkflow = Get-Content -Raw (Join-Path $repoRoot ".github/workflows/deploy-cloudflare-staging.yml")
Assert-Equal ([bool]($stagingWorkflow -match "group: cloudflare-staging")) $true "Cloudflare staging deploys must share one concurrency group"
Assert-Equal ([bool]($stagingWorkflow -match "cancel-in-progress: false")) $true "Cloudflare staging deploys must not be cancelled during mutation"
Assert-Equal ([bool]($stagingWorkflow -match "commit_sha:")) $true "Cloudflare staging must accept a pinned commit SHA"
Assert-Equal ([bool]($stagingWorkflow -match "\.release-control/scripts/check_release_candidate.ps1")) $true "Cloudflare staging must recheck its release candidate with trusted controls"
Assert-Equal ([bool]($stagingWorkflow -match '(?m)^\s{2}push:')) $false "Cloudflare staging must not expose its environment from a feature-branch push workflow"
Assert-Equal ([bool]($stagingWorkflow -match 'refs/heads/main')) $true "Cloudflare staging mutations must use the workflow definition from main"
Assert-Equal ([bool]($stagingWorkflow -match 'target=\$\{\{ inputs\.commit_sha \}\}')) $true "Cloudflare staging run titles must retain the candidate SHA for resumable lookup"

$productionWorkflow = Get-Content -Raw (Join-Path $repoRoot ".github/workflows/deploy.yml")
Assert-Equal ([bool]($productionWorkflow -match '(?m)^\s{2}workflow_dispatch:')) $false "Production deploy must only start from a main push"

$autopilot = Get-Content -Raw (Join-Path $repoRoot "scripts/release_autopilot.ps1")
Assert-Equal ([bool]($autopilot -match '\$nativeExitCode = \$LASTEXITCODE')) $true "Autopilot native commands must decide from exit codes instead of stderr records"
Assert-Equal ([bool]($autopilot -match 'Write-Host "\$Workflow pending:')) $true "Workflow progress must not pollute the run object returned to final JSON"
Assert-Equal ([bool]($autopilot -match 'headRefOid,statusCheckRollup,url')) $true "Required-check polling must observe the current PR head SHA"
Assert-Equal ([bool]($autopilot -match 'PR head changed while waiting for checks')) $true "Required-check polling must fail when the PR head changes"
Assert-Equal ([bool]($autopilot -match '"--match-head-commit", \$headSha')) $true "Auto-merge must be conditional on the staged head SHA"
Assert-Equal ([bool]($autopilot -match '"--ref", "main"')) $true "Staging dispatch must load its workflow from main"
Assert-Equal ([bool]($autopilot -match 'Get-StagingRunDecision')) $true "Staging resume must decide from the globally latest staging run"
Assert-Equal ([bool]($autopilot -match 'Wait-WorkflowRun -Workflow "deploy\.yml".+-BranchFilter "main"')) $true "Production monitoring must query main rather than the deleted feature branch"
$preCommitGuardIndex = $autopilot.IndexOf('Pre-commit deploy guardrails failed')
$commitIndex = $autopilot.IndexOf('Invoke-Git -Arguments @("commit",')
$prePushGuardIndex = $autopilot.IndexOf('Pre-push local deploy preflight failed')
$pushIndex = $autopilot.IndexOf('Invoke-Git -Arguments @("push",')
Assert-Equal ([bool]($preCommitGuardIndex -ge 0 -and $commitIndex -gt $preCommitGuardIndex)) $true "Deploy path guardrails must run before commit"
Assert-Equal ([bool]($prePushGuardIndex -ge 0 -and $pushIndex -gt $prePushGuardIndex)) $true "Local deploy preflight must run before push"

$worktreeScript = Get-Content -Raw (Join-Path $repoRoot "scripts/new_release_worktree.ps1")
$candidateScript = Get-Content -Raw (Join-Path $repoRoot "scripts/check_release_candidate.ps1")
Assert-Equal ([bool]($worktreeScript -match '\$nativeExitCode = \$LASTEXITCODE')) $true "Worktree creation must not treat normal git stderr progress as failure"
Assert-Equal ([bool]($candidateScript -match '\$nativeExitCode = \$LASTEXITCODE')) $true "Candidate checks must decide gh success from its exit code"

Write-Output "release automation tests passed: $script:assertions assertions"
