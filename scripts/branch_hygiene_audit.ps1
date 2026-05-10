param(
    [string]$Repository = $env:GITHUB_REPOSITORY,
    [int]$StaleDays = 30,
    [int]$RunLimit = 5,
    [switch]$EmitGithubSummary,
    [switch]$FailOnStagingDrift
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Repository)) {
    $Repository = (& gh repo view --json nameWithOwner --jq ".nameWithOwner").Trim()
}

if ([string]::IsNullOrWhiteSpace($Repository)) {
    throw "Repository is required. Set GITHUB_REPOSITORY or pass -Repository owner/name."
}

function Invoke-GhJson {
    param([string[]]$GhArgs)

    $errFile = [System.IO.Path]::GetTempFileName()
    try {
        $output = & gh @GhArgs 2> $errFile
        $exitCode = $LASTEXITCODE
        $errText = Get-Content -Raw -Path $errFile
    }
    finally {
        Remove-Item -LiteralPath $errFile -Force -ErrorAction SilentlyContinue
    }

    if ($exitCode -ne 0) {
        throw "gh $($GhArgs -join ' ') failed:`n$errText`n$($output -join "`n")"
    }

    $text = ($output -join "`n").Trim()
    if ([string]::IsNullOrWhiteSpace($text)) {
        return $null
    }

    return $text | ConvertFrom-Json
}

function Invoke-Git {
    param([string[]]$GitArgs)

    $output = & git @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed."
    }
    return @($output)
}

function Format-State {
    param($Status, $Conclusion)

    if ($Status -ne "completed") {
        return [string]$Status
    }
    if ([string]::IsNullOrWhiteSpace([string]$Conclusion)) {
        return "completed"
    }
    return [string]$Conclusion
}

function Add-Line {
    param(
        [System.Collections.Generic.List[string]]$Lines,
        [string]$Line = ""
    )

    $Lines.Add($Line)
}

function Format-NullableBool {
    param($Value)

    if ($null -eq $Value) {
        return "unknown"
    }
    return [string]$Value
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI 'gh' is required."
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git is required."
}

$repoSettings = Invoke-GhJson -GhArgs @(
    "api", "repos/$Repository",
    "--jq", "{delete_branch_on_merge, default_branch, allow_squash_merge, allow_merge_commit, allow_rebase_merge}"
)

$defaultBranch = [string]$repoSettings.default_branch
if ([string]::IsNullOrWhiteSpace($defaultBranch)) {
    $defaultBranch = "main"
}

Invoke-Git -GitArgs @(
    "fetch", "--quiet", "origin",
    "+refs/heads/*:refs/remotes/origin/*",
    "--prune"
) | Out-Null

$now = Get-Date
$staleCutoff = $now.AddDays(-1 * $StaleDays)
$protectedNames = @($defaultBranch, "staging")

$defaultProtection = $null
try {
    $defaultProtection = Invoke-GhJson -GhArgs @(
        "api", "repos/$Repository/branches/$defaultBranch/protection",
        "--jq", "{required_linear_history, allow_force_pushes, allow_deletions, required_status_checks, required_pull_request_reviews}"
    )
}
catch {
    $defaultProtection = $null
}

$remoteRefs = Invoke-Git -GitArgs @(
    "for-each-ref",
    "--format=%(refname:short)|%(committerdate:iso8601)|%(objectname:short)|%(subject)",
    "refs/remotes/origin"
)

$branches = New-Object System.Collections.Generic.List[object]
foreach ($line in $remoteRefs) {
    $parts = [string]$line -split "\|", 4
    if ($parts.Count -lt 4) {
        continue
    }

    $ref = $parts[0]
    if ($ref -eq "origin" -or $ref -eq "origin/HEAD") {
        continue
    }

    $name = $ref -replace "^origin/", ""
    $date = [datetime]::Parse($parts[1])

    $merged = $false
    & git merge-base --is-ancestor $ref "origin/$defaultBranch" *> $null
    if ($LASTEXITCODE -eq 0) {
        $merged = $true
    }

    $ahead = $null
    $behind = $null
    $divergence = & git rev-list --left-right --count "origin/$defaultBranch...$ref" 2>$null
    if ($LASTEXITCODE -eq 0 -and $divergence) {
        $counts = ([string]$divergence).Trim() -split "\s+"
        if ($counts.Count -ge 2) {
            $behind = [int]$counts[0]
            $ahead = [int]$counts[1]
        }
    }

    $branches.Add([pscustomobject]@{
        Name = $name
        Ref = $ref
        Date = $date
        Sha = $parts[2]
        Subject = $parts[3]
        IsProtectedOperational = $protectedNames -contains $name
        IsMergedToDefault = $merged
        IsStale = $date -lt $staleCutoff
        AheadDefault = $ahead
        BehindDefault = $behind
    })
}

$openPrs = Invoke-GhJson -GhArgs @(
    "pr", "list",
    "--repo", $Repository,
    "--state", "open",
    "--limit", "100",
    "--json", "number,title,headRefName,baseRefName,updatedAt,mergeStateStatus,isDraft,url"
)
$openPrs = @($openPrs)

$deployRuns = @{}
foreach ($workflow in @("deploy.yml", "deploy-staging.yml")) {
    $runs = Invoke-GhJson -GhArgs @(
        "run", "list",
        "--repo", $Repository,
        "--workflow", $workflow,
        "--limit", [string]$RunLimit,
        "--json", "databaseId,displayTitle,headBranch,headSha,status,conclusion,createdAt,updatedAt,url,event"
    )
    $deployRuns[$workflow] = @($runs)
}

$activeBranches = @($branches | Where-Object { $_.IsProtectedOperational } | Sort-Object Name)
$stagingBranch = @($branches | Where-Object { $_.Name -eq "staging" } | Select-Object -First 1)
$stagingDriftMessages = New-Object System.Collections.Generic.List[string]
if ($stagingBranch.Count -eq 0) {
    $stagingDriftMessages.Add("staging branch is missing.")
}
elseif ($null -eq $stagingBranch.AheadDefault -or $null -eq $stagingBranch.BehindDefault) {
    $stagingDriftMessages.Add("staging branch divergence from $defaultBranch could not be calculated.")
}
elseif ($stagingBranch.AheadDefault -gt 0 -or $stagingBranch.BehindDefault -gt 0) {
    $stagingDriftMessages.Add("staging is out of sync with $defaultBranch (ahead=$($stagingBranch.AheadDefault), behind=$($stagingBranch.BehindDefault)).")
}

$staleBranches = @(
    $branches |
        Where-Object { -not $_.IsProtectedOperational -and $_.IsStale } |
        Sort-Object Date
)
$mergedBranches = @(
    $branches |
        Where-Object { -not $_.IsProtectedOperational -and $_.IsMergedToDefault } |
        Sort-Object Date
)

$lines = New-Object System.Collections.Generic.List[string]
Add-Line $lines "# Branch Hygiene Audit"
Add-Line $lines ""
Add-Line $lines "- Repository: $Repository"
Add-Line $lines "- Default branch: $defaultBranch"
Add-Line $lines "- Delete branch on merge: $(Format-NullableBool $repoSettings.delete_branch_on_merge)"
Add-Line $lines "- Squash merge: $(Format-NullableBool $repoSettings.allow_squash_merge)"
Add-Line $lines "- Merge commit: $(Format-NullableBool $repoSettings.allow_merge_commit)"
Add-Line $lines "- Rebase merge: $(Format-NullableBool $repoSettings.allow_rebase_merge)"
if ($defaultProtection -and $defaultProtection.required_linear_history) {
    Add-Line $lines "- $defaultBranch linear history: $(Format-NullableBool $defaultProtection.required_linear_history.enabled)"
}
else {
    Add-Line $lines "- $defaultBranch linear history: unknown"
}
Add-Line $lines "- Stale threshold: $StaleDays days"
Add-Line $lines "- Generated: $($now.ToString("yyyy-MM-dd HH:mm:ss zzz"))"
Add-Line $lines ""

if ($repoSettings.delete_branch_on_merge -eq $false) {
    Add-Line $lines "> WARNING: GitHub delete_branch_on_merge is disabled. Enable it to prevent merged branch buildup."
    if ($env:GITHUB_ACTIONS -eq "true") {
        Write-Output "::warning::GitHub delete_branch_on_merge is disabled for $Repository."
    }
    Add-Line $lines ""
}

if ($repoSettings.allow_squash_merge -eq $false -or $repoSettings.allow_merge_commit -eq $true -or $repoSettings.allow_rebase_merge -eq $true) {
    Add-Line $lines "> WARNING: Merge policy should be squash-only for branch hygiene."
    if ($env:GITHUB_ACTIONS -eq "true") {
        Write-Output "::warning::Merge policy should be squash-only for $Repository."
    }
    Add-Line $lines ""
}

if ($defaultProtection -and $defaultProtection.required_linear_history -and $defaultProtection.required_linear_history.enabled -eq $false) {
    Add-Line $lines "> WARNING: $defaultBranch required_linear_history is not enabled."
    if ($env:GITHUB_ACTIONS -eq "true") {
        Write-Output "::warning::$defaultBranch required_linear_history is not enabled for $Repository."
    }
    Add-Line $lines ""
}

if ($stagingDriftMessages.Count -gt 0) {
    foreach ($message in $stagingDriftMessages) {
        Add-Line $lines "> WARNING: $message"
        if ($env:GITHUB_ACTIONS -eq "true") {
            Write-Output "::warning::$message"
        }
    }
    Add-Line $lines ""
}

Add-Line $lines "## Operational Branches"
Add-Line $lines ""
if ($activeBranches.Count -eq 0) {
    Add-Line $lines "- none"
}
else {
    foreach ($branch in $activeBranches) {
        Add-Line $lines "- $($branch.Name): $($branch.Sha) $($branch.Subject)"
    }
}
Add-Line $lines ""

Add-Line $lines "## Staging Sync"
Add-Line $lines ""
if ($stagingDriftMessages.Count -eq 0) {
    Add-Line $lines "- staging is aligned with $defaultBranch."
}
else {
    foreach ($message in $stagingDriftMessages) {
        Add-Line $lines "- $message"
    }
}
Add-Line $lines ""

Add-Line $lines "## Open PRs"
Add-Line $lines ""
if ($openPrs.Count -eq 0) {
    Add-Line $lines "- none"
}
else {
    foreach ($pr in $openPrs) {
        $draft = if ($pr.isDraft) { " draft" } else { "" }
        Add-Line $lines "- #$($pr.number)$draft [$($pr.mergeStateStatus)] $($pr.headRefName) -> $($pr.baseRefName): $($pr.title)"
        Add-Line $lines "  $($pr.url)"
    }
}
Add-Line $lines ""

Add-Line $lines "## Stale Branches"
Add-Line $lines ""
if ($staleBranches.Count -eq 0) {
    Add-Line $lines "- none"
}
else {
    foreach ($branch in $staleBranches) {
        $age = [int](($now - $branch.Date).TotalDays)
        $merged = if ($branch.IsMergedToDefault) { "merged" } else { "unmerged" }
        $aheadBehind = ""
        if ($null -ne $branch.AheadDefault -and $null -ne $branch.BehindDefault) {
            $aheadBehind = " ahead=$($branch.AheadDefault) behind=$($branch.BehindDefault)"
        }
        Add-Line $lines "- $($branch.Name): ${age}d $merged$aheadBehind, $($branch.Sha) $($branch.Subject)"
    }
}
Add-Line $lines ""

Add-Line $lines "## Merged Non-Operational Branches"
Add-Line $lines ""
if ($mergedBranches.Count -eq 0) {
    Add-Line $lines "- none"
}
else {
    foreach ($branch in $mergedBranches) {
        Add-Line $lines "- $($branch.Name): $($branch.Sha) $($branch.Subject)"
    }
}
Add-Line $lines ""

Add-Line $lines "## Deploy Runs"
foreach ($workflow in @("deploy.yml", "deploy-staging.yml")) {
    Add-Line $lines ""
    Add-Line $lines "### $workflow"
    $runs = @($deployRuns[$workflow])
    if ($runs.Count -eq 0) {
        Add-Line $lines "- none"
        continue
    }

    foreach ($run in $runs) {
        $state = Format-State -Status $run.status -Conclusion $run.conclusion
        Add-Line $lines "- $state run=$($run.databaseId) branch=$($run.headBranch) event=$($run.event) updated=$($run.updatedAt)"
        Add-Line $lines "  $($run.url)"
    }
}

$output = $lines -join "`n"
Write-Output $output

if ($EmitGithubSummary -and -not [string]::IsNullOrWhiteSpace($env:GITHUB_STEP_SUMMARY)) {
    Add-Content -Path $env:GITHUB_STEP_SUMMARY -Value $output
}

if ($FailOnStagingDrift -and $stagingDriftMessages.Count -gt 0) {
    throw "Staging branch drift detected. Align staging with $defaultBranch or rerun without -FailOnStagingDrift for a report-only audit."
}
