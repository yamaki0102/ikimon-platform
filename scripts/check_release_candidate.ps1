[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Repository,
    [Parameter(Mandatory = $true)][string]$Branch,
    [Parameter(Mandatory = $true)][string]$Sha,
    [string]$BaseBranch = "main",
    [string]$ManifestPath = "ops/deploy/staging_manifest.json"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$env:GH_PROMPT_DISABLED = "1"

. (Join-Path $PSScriptRoot "release_automation_lib.ps1")

if ($Repository -notmatch "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$") {
    throw "Repository must use owner/name format."
}
if ($Branch -notlike "codex/*") {
    throw "Staging release candidates must use a codex/* branch."
}
if ($Sha -notmatch "^[0-9a-fA-F]{40}$") {
    throw "Sha must be a full 40-character Git commit SHA."
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI 'gh' is required."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestFullPath = if ([System.IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $repoRoot $ManifestPath }
$manifest = Get-Content -Raw -Path $manifestFullPath | ConvertFrom-Json
$requiredContexts = @($manifest.promotion.requiredStatusContexts)
if ($requiredContexts.Count -eq 0) {
    throw "Staging manifest has no promotion.requiredStatusContexts."
}

function Invoke-GhChecked {
    param([string[]]$Arguments)

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = @(& gh @Arguments 2>&1)
        $nativeExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($nativeExitCode -ne 0) {
        throw "gh $($Arguments -join ' ') failed:`n$($output -join "`n")"
    }
    return @($output | ForEach-Object { [string]$_ })
}

function Invoke-GhJson {
    param([string[]]$Arguments)

    $text = (Invoke-GhChecked -Arguments $Arguments) -join "`n"
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    return $text | ConvertFrom-Json
}

$pullRequests = @(Invoke-GhJson -Arguments @(
    "pr", "list", "--repo", $Repository, "--head", $Branch, "--base", $BaseBranch,
    "--state", "open", "--limit", "10", "--json", "number,isDraft,headRefOid,url"
))
$candidatePullRequests = @($pullRequests | Where-Object { $_.headRefOid -eq $Sha })
if ($candidatePullRequests.Count -ne 1) {
    throw "Expected one open PR from $Branch to $BaseBranch at $Sha; found $($candidatePullRequests.Count)."
}
$pullRequest = $candidatePullRequests[0]
if ($pullRequest.isDraft) {
    throw "Release candidate PR is still a draft: $($pullRequest.url)"
}

$checkRuns = Invoke-GhJson -Arguments @(
    "api", "-X", "GET", "repos/$Repository/commits/$Sha/check-runs?per_page=100",
    "-H", "Accept: application/vnd.github+json"
)
$combinedStatus = Invoke-GhJson -Arguments @(
    "api", "-X", "GET", "repos/$Repository/commits/$Sha/status?per_page=100",
    "-H", "Accept: application/vnd.github+json"
)

$rollup = New-Object System.Collections.Generic.List[object]
foreach ($check in @($checkRuns.check_runs)) {
    $rollup.Add([pscustomobject]@{
        name = $check.name
        status = $check.status
        conclusion = $check.conclusion
        completedAt = $check.completed_at
        startedAt = $check.started_at
    })
}
foreach ($status in @($combinedStatus.statuses)) {
    $rollup.Add([pscustomobject]@{
        context = $status.context
        state = $status.state
        updatedAt = $status.updated_at
    })
}

$checksState = Get-RequiredChecksState -RequiredContexts $requiredContexts -Rollup ([object[]]$rollup.ToArray())
if ($checksState.state -eq "failed") {
    throw "Required checks failed for ${Sha}: $($checksState.failed -join ', ')."
}
if ($checksState.state -ne "ready") {
    throw "Required checks are not ready for ${Sha}: $($checksState.pending -join ', ')."
}

[pscustomobject]@{
    status = "verified"
    repository = $Repository
    branch = $Branch
    sha = $Sha.ToLowerInvariant()
    pullRequest = $pullRequest.url
    requiredStatusContexts = $requiredContexts
} | ConvertTo-Json -Depth 5 -Compress
