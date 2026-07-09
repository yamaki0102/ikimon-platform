[CmdletBinding()]
param(
    [string[]]$Paths,
    [string]$CommitMessage,
    [string]$Title,
    [string]$Body,
    [string]$BodyFile,
    [switch]$PromoteProduction,
    [switch]$DryRun,
    [switch]$RetryFailedStaging,
    [int]$PollSeconds = 15,
    [int]$TimeoutMinutes = 90
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

. (Join-Path $PSScriptRoot "release_automation_lib.ps1")

$env:GH_PROMPT_DISABLED = "1"
$env:GIT_TERMINAL_PROMPT = "0"
$env:GCM_INTERACTIVE = "never"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$normalizedPaths = New-Object System.Collections.Generic.List[string]
foreach ($pathArgument in @($Paths)) {
    foreach ($item in ([string]$pathArgument -split "[,;]")) {
        $trimmed = $item.Trim()
        if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
            $normalizedPaths.Add($trimmed)
        }
    }
}
$Paths = [string[]]$normalizedPaths.ToArray()

function Invoke-NativeChecked {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [string[]]$Arguments = @()
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = @(& $Command @Arguments 2>&1)
        $nativeExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($nativeExitCode -ne 0) {
        throw "$Command $($Arguments -join ' ') failed:`n$($output -join "`n")"
    }
    return @($output | ForEach-Object { [string]$_ })
}

function Invoke-Git {
    param([string[]]$Arguments)
    return Invoke-NativeChecked -Command "git" -Arguments (@("-C", $repoRoot) + $Arguments)
}

function Invoke-Gh {
    param([string[]]$Arguments)
    if ($Arguments.Count -gt 0 -and $Arguments[0] -eq "api") {
        return Invoke-NativeChecked -Command "gh" -Arguments $Arguments
    }
    return Invoke-NativeChecked -Command "gh" -Arguments ($Arguments + @("--repo", $repository))
}

function Invoke-GhJson {
    param([string[]]$Arguments)
    $text = (Invoke-Gh -Arguments $Arguments) -join "`n"
    if ([string]::IsNullOrWhiteSpace($text)) {
        return $null
    }
    return $text | ConvertFrom-Json
}

function Get-StatusPath {
    param([string]$Line)

    if ($Line.Length -lt 4) { return "" }
    $path = $Line.Substring(3).Trim()
    if ($path.Contains(" -> ")) {
        $path = ($path -split " -> ")[-1]
    }
    return $path.Replace("\", "/")
}

function Test-PathCovered {
    param([string]$ChangedPath, [string[]]$Scopes)

    foreach ($scopeValue in $Scopes) {
        $scope = $scopeValue.Replace("\", "/").TrimEnd("/")
        if ($scope -match "[*?\[\]]") {
            throw "Paths must be literal files or directories, not wildcards: $scopeValue"
        }
        if ($ChangedPath -eq $scope -or $ChangedPath.StartsWith("$scope/")) {
            return $true
        }
    }
    return $false
}

function Get-WorkflowRuns {
    param(
        [string]$Workflow,
        [string]$BranchFilter = $branch
    )

    return @(Invoke-GhJson -Arguments @(
        "run", "list", "--workflow", $Workflow, "--branch", $BranchFilter,
        "--limit", "30", "--json", "databaseId,displayTitle,headSha,status,conclusion,url,event,createdAt"
    ))
}

function Get-WorkflowRunsForSha {
    param(
        [string]$Workflow,
        [string]$Sha,
        [string]$Event,
        [string]$BranchFilter = $branch,
        [switch]$MatchTargetShaInTitle
    )

    $runs = @(Get-WorkflowRuns -Workflow $Workflow -BranchFilter $BranchFilter)
    return @($runs | Where-Object {
        $shaMatches = if ($MatchTargetShaInTitle) {
            ([string]$_.displayTitle).Contains("target=$Sha")
        }
        else {
            $_.headSha -eq $Sha
        }
        $shaMatches -and (-not $Event -or $_.event -eq $Event)
    })
}

function Wait-WorkflowRun {
    param(
        [string]$Workflow,
        [string]$Sha,
        [string]$Event,
        [string]$BranchFilter = $branch,
        [switch]$MatchTargetShaInTitle,
        [datetime]$NotBefore = [datetime]::MinValue
    )

    $deadline = [datetime]::UtcNow.AddMinutes($TimeoutMinutes)
    while ([datetime]::UtcNow -lt $deadline) {
        $runs = @(Get-WorkflowRunsForSha -Workflow $Workflow -Sha $Sha -Event $Event -BranchFilter $BranchFilter -MatchTargetShaInTitle:$MatchTargetShaInTitle | Where-Object {
            [datetime]$_.createdAt -ge $NotBefore
        } | Sort-Object { [datetime]$_.createdAt } -Descending)
        if ($runs.Count -gt 0) {
            $run = $runs[0]
            if ($run.status -eq "completed") {
                if ($run.conclusion -ne "success") {
                    throw "$Workflow failed with conclusion '$($run.conclusion)': $($run.url)"
                }
                return $run
            }
            Write-Host "$Workflow pending: $($run.status) $($run.url)"
        }
        Start-Sleep -Seconds $PollSeconds
    }
    throw "Timed out waiting for $Workflow at $Sha."
}

function Wait-RequiredChecks {
    param([int]$PrNumber, [string]$ExpectedSha, [string[]]$RequiredContexts)

    $deadline = [datetime]::UtcNow.AddMinutes($TimeoutMinutes)
    while ([datetime]::UtcNow -lt $deadline) {
        $pr = Invoke-GhJson -Arguments @("pr", "view", [string]$PrNumber, "--json", "headRefOid,statusCheckRollup,url")
        if ($pr.headRefOid -ne $ExpectedSha) {
            throw "PR head changed while waiting for checks: expected=$ExpectedSha actual=$($pr.headRefOid). Start a new release attempt for the new SHA."
        }
        $state = Get-RequiredChecksState -RequiredContexts $RequiredContexts -Rollup @($pr.statusCheckRollup)
        if ($state.state -eq "ready") {
            return $state
        }
        if ($state.state -eq "failed") {
            throw "Required checks failed: $($state.failed -join ', '). PR: $($pr.url)"
        }
        Write-Output "Required checks pending: $($state.pending -join ', ')"
        Start-Sleep -Seconds $PollSeconds
    }
    throw "Timed out waiting for required checks."
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI 'gh' is required."
}
Invoke-NativeChecked -Command "gh" -Arguments @("auth", "status", "--hostname", "github.com") | Out-Null

$remoteUrl = (Invoke-Git -Arguments @("config", "--get", "remote.origin.url") | Select-Object -First 1)
$repository = Get-RepositorySlug -RemoteUrl $remoteUrl
$branch = (Invoke-Git -Arguments @("branch", "--show-current") | Select-Object -First 1)
if ($branch -notlike "codex/*") {
    throw "Release autopilot requires a codex/* branch. Current branch: $branch"
}

$statusLines = @(Invoke-Git -Arguments @("status", "--porcelain=v1", "-uall") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
$changedPaths = @($statusLines | ForEach-Object { Get-StatusPath -Line $_ } | Where-Object { $_ } | Sort-Object -Unique)
if ($changedPaths.Count -gt 0) {
    if (@($Paths).Count -eq 0) {
        throw "Working tree has changes. Pass -Paths with the exact files or directories owned by this release."
    }
    $unscoped = @($changedPaths | Where-Object { -not (Test-PathCovered -ChangedPath $_ -Scopes $Paths) })
    if ($unscoped.Count -gt 0) {
        throw "Unscoped working-tree changes found: $($unscoped -join ', '). Use a dedicated release worktree."
    }
}

if ($DryRun) {
    $dryChanged = $changedPaths
    if ($dryChanged.Count -eq 0) {
        $dryChanged = @(Invoke-Git -Arguments @("diff", "--name-only", "origin/main...HEAD") | Where-Object { $_ })
    }
    [pscustomobject]@{
        status = "dry-run"
        repository = $repository
        branch = $branch
        changedPaths = @($dryChanged)
        requiresCloudflareStaging = (Test-RequiresCloudflareStaging -ChangedPaths @($dryChanged))
        promoteProduction = [bool]$PromoteProduction
        mutationsExecuted = $false
    } | ConvertTo-Json -Depth 5
    exit 0
}

Invoke-Git -Arguments @("fetch", "origin", "main") | Out-Null
$divergence = (Invoke-Git -Arguments @("rev-list", "--left-right", "--count", "origin/main...HEAD") | Select-Object -First 1) -split "\s+"
$behindMain = [int]$divergence[0]
if ($behindMain -gt 0) {
    throw "Branch is behind origin/main by $behindMain commits. Start a fresh release worktree before publishing."
}

if ($changedPaths.Count -gt 0) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_deploy_guardrails.ps1")
    if ($LASTEXITCODE -ne 0) {
        throw "Pre-commit deploy guardrails failed."
    }
    Invoke-Git -Arguments (@("add", "--") + @($Paths)) | Out-Null
    $stagedPaths = @(Invoke-Git -Arguments @("diff", "--cached", "--name-only") | Where-Object { $_ })
    if ($stagedPaths.Count -eq 0) {
        throw "No staged changes were produced from -Paths."
    }
    Invoke-Git -Arguments @("diff", "--cached", "--check") | Out-Null
    $secretFindings = Test-AddedLinesForSecrets -DiffLines @(Invoke-Git -Arguments @("diff", "--cached", "--no-ext-diff", "--unified=0"))
    if (@($secretFindings).Count -gt 0) {
        $kinds = @($secretFindings | ForEach-Object { $_.kind } | Sort-Object -Unique)
        throw "Possible secret literal detected in staged additions: $($kinds -join ', '). No secret value was printed."
    }

    if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
        if (-not [string]::IsNullOrWhiteSpace($Title)) {
            $CommitMessage = $Title
        }
        else {
            $CommitMessage = "chore: $($branch.Substring(6))"
        }
    }
    Invoke-Git -Arguments @("commit", "-m", $CommitMessage) | Out-Null
}

$remainingStatus = @(Invoke-Git -Arguments @("status", "--porcelain=v1", "-uall") | Where-Object { $_ })
if ($remainingStatus.Count -gt 0) {
    throw "Working tree is still dirty after the scoped commit. Use a dedicated release worktree."
}

$releasePaths = @(Invoke-Git -Arguments @("diff", "--name-only", "origin/main...HEAD") | Where-Object { $_ })
if ($releasePaths.Count -eq 0) {
    throw "Branch has no changes relative to origin/main."
}
$headSha = (Invoke-Git -Arguments @("rev-parse", "HEAD") | Select-Object -First 1)

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "local_deploy_preflight.ps1") -BaseRef origin/main -RequireCodexBranch
if ($LASTEXITCODE -ne 0) {
    throw "Pre-push local deploy preflight failed."
}

Invoke-Git -Arguments @("push", "--set-upstream", "origin", $branch) | Out-Null
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "local_deploy_preflight.ps1") -BaseRef origin/main -RequireCodexBranch -RequireUpstreamSync
if ($LASTEXITCODE -ne 0) {
    throw "Local deploy preflight failed after push."
}

$openPrs = @(Invoke-GhJson -Arguments @("pr", "list", "--head", $branch, "--base", "main", "--state", "open", "--limit", "1", "--json", "number,title,url,headRefOid,isDraft"))
if ($openPrs.Count -gt 0) {
    $pr = $openPrs[0]
}
else {
    if ([string]::IsNullOrWhiteSpace($Title)) {
        $Title = (Invoke-Git -Arguments @("log", "-1", "--pretty=%s") | Select-Object -First 1)
    }
    if ($BodyFile) {
        $Body = Get-Content -Raw -Path $BodyFile
    }
    if ([string]::IsNullOrWhiteSpace($Body)) {
        $Body = @"
## 変更内容
- Automated release for `$branch`.

## 影響範囲
- $($releasePaths -join "`n- ")

## 検証
- local deploy preflight: pass
- required checks: pending

## 本番反映の有無
- `-PromoteProduction`: $([bool]$PromoteProduction)

## review重点
- scoped changes only
- deploy and data boundaries
"@
    }
    Invoke-Gh -Arguments @("pr", "create", "--base", "main", "--head", $branch, "--title", $Title, "--body", $Body) | Out-Null
    $pr = @(Invoke-GhJson -Arguments @("pr", "list", "--head", $branch, "--base", "main", "--state", "open", "--limit", "1", "--json", "number,title,url,headRefOid,isDraft"))[0]
}

if ($pr.isDraft) {
    Invoke-Gh -Arguments @("pr", "ready", [string]$pr.number) | Out-Null
    $pr = Invoke-GhJson -Arguments @("pr", "view", [string]$pr.number, "--json", "number,title,url,headRefOid,isDraft")
}

$protection = Invoke-GhJson -Arguments @("api", "repos/$repository/branches/main/protection/required_status_checks")
$requiredContexts = @($protection.contexts)
Wait-RequiredChecks -PrNumber ([int]$pr.number) -ExpectedSha $headSha -RequiredContexts $requiredContexts | Out-Null

$stagingRun = $null
$requiresStaging = Test-RequiresCloudflareStaging -ChangedPaths $releasePaths
if ($requiresStaging) {
    $allStagingRuns = @(Get-WorkflowRuns -Workflow "deploy-cloudflare-staging.yml" -BranchFilter "main" | Where-Object { $_.event -eq "workflow_dispatch" })
    $stagingDecision = Get-StagingRunDecision -Runs $allStagingRuns -TargetSha $headSha -RetryFailed:$RetryFailedStaging
    if ($stagingDecision.action -eq "reuse") {
        $stagingRun = $stagingDecision.run
    }
    elseif ($stagingDecision.action -eq "wait") {
        $stagingRun = Wait-WorkflowRun -Workflow "deploy-cloudflare-staging.yml" -Sha $headSha -Event "workflow_dispatch" -BranchFilter "main" -MatchTargetShaInTitle
    }
    elseif ($stagingDecision.action -eq "block") {
        throw "The current Cloudflare staging run already failed for $headSha. Fix the cause or rerun with -RetryFailedStaging."
    }
    else {
        $dispatchTime = [datetime]::UtcNow.AddMinutes(-1)
        Invoke-Gh -Arguments @("workflow", "run", "deploy-cloudflare-staging.yml", "--ref", "main", "-f", "branch=$branch", "-f", "commit_sha=$headSha", "-f", "deploy_staging=true", "-f", "test_profile=full") | Out-Null
        $stagingRun = Wait-WorkflowRun -Workflow "deploy-cloudflare-staging.yml" -Sha $headSha -Event "workflow_dispatch" -BranchFilter "main" -MatchTargetShaInTitle -NotBefore $dispatchTime
    }
}

if (-not $PromoteProduction) {
    [pscustomobject]@{
        status = "ready-for-production"
        repository = $repository
        branch = $branch
        headSha = $headSha
        pullRequest = $pr.url
        stagingRequired = $requiresStaging
        stagingRun = $(if ($stagingRun) { $stagingRun.url } else { $null })
        productionPromoted = $false
    } | ConvertTo-Json -Depth 5
    exit 0
}

$repoSettings = Invoke-GhJson -Arguments @("api", "repos/$repository")
if (-not $repoSettings.allow_auto_merge) {
    throw "Repository auto-merge is disabled. Enable allow_auto_merge before production autopilot."
}

Invoke-Gh -Arguments @("pr", "merge", [string]$pr.number, "--auto", "--squash", "--match-head-commit", $headSha) | Out-Null
$mergeDeadline = [datetime]::UtcNow.AddMinutes($TimeoutMinutes)
do {
    $mergedPr = Invoke-GhJson -Arguments @("pr", "view", [string]$pr.number, "--json", "state,mergedAt,mergeCommit,url")
    if ($mergedPr.state -eq "MERGED") { break }
    if ($mergedPr.state -eq "CLOSED") { throw "PR closed without merge: $($mergedPr.url)" }
    Start-Sleep -Seconds $PollSeconds
} while ([datetime]::UtcNow -lt $mergeDeadline)
if ($mergedPr.state -ne "MERGED") {
    throw "Timed out waiting for PR auto-merge."
}

$mergeSha = $mergedPr.mergeCommit.oid
$productionRun = Wait-WorkflowRun -Workflow "deploy.yml" -Sha $mergeSha -Event "push" -BranchFilter "main"

[pscustomobject]@{
    status = "production-deployed"
    repository = $repository
    pullRequest = $mergedPr.url
    mergeSha = $mergeSha
    stagingRun = $(if ($stagingRun) { $stagingRun.url } else { $null })
    productionRun = $productionRun.url
    productionPromoted = $true
} | ConvertTo-Json -Depth 5
