[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$TaskName,
    [string]$BaseRef = "origin/main",
    [string]$WorktreeRoot,
    [switch]$NoFetch,
    [switch]$DryRun,
    [switch]$Json
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$env:GIT_TERMINAL_PROMPT = "0"
$env:GCM_INTERACTIVE = "never"

. (Join-Path $PSScriptRoot "release_automation_lib.ps1")

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$taskSlug = ConvertTo-ReleaseTaskName -TaskName $TaskName
$branch = "codex/$taskSlug"

if (-not $WorktreeRoot) {
    $WorktreeRoot = Get-DefaultReleaseWorktreeRoot -RepoRoot $repoRoot
}
$WorktreeRoot = [System.IO.Path]::GetFullPath($WorktreeRoot)
$targetPath = Join-Path $WorktreeRoot $taskSlug

function Invoke-GitChecked {
    param([string[]]$Arguments)

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = @(& git -C $repoRoot @Arguments 2>&1)
        $nativeExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($nativeExitCode -ne 0) {
        throw "git $($Arguments -join ' ') failed:`n$($output -join "`n")"
    }
    return $output
}

$registered = @{}
$currentPath = $null
foreach ($line in @(Invoke-GitChecked -Arguments @("worktree", "list", "--porcelain"))) {
    if ($line -match "^worktree\s+(.+)$") {
        $currentPath = [System.IO.Path]::GetFullPath($matches[1])
        $registered[$currentPath] = $null
    }
    elseif ($currentPath -and $line -match "^branch\s+refs/heads/(.+)$") {
        $registered[$currentPath] = $matches[1]
    }
}

$existingForBranch = @($registered.GetEnumerator() | Where-Object { $_.Value -eq $branch } | Select-Object -First 1)
if ($existingForBranch.Count -gt 0) {
    $result = [pscustomobject]@{
        status = "existing"
        branch = $branch
        baseRef = $BaseRef
        worktree = $existingForBranch[0].Key
    }
    if ($Json) { $result | ConvertTo-Json -Compress } else { $result | Format-List }
    exit 0
}

if (Test-Path -LiteralPath $targetPath) {
    throw "Target path exists but is not the requested worktree: $targetPath"
}

if (-not $NoFetch -and -not $DryRun) {
    Invoke-GitChecked -Arguments @("fetch", "origin", "main") | Out-Null
}
Invoke-GitChecked -Arguments @("rev-parse", "--verify", $BaseRef) | Out-Null

$localBranchExists = $false
& git -C $repoRoot show-ref --verify --quiet "refs/heads/$branch"
if ($LASTEXITCODE -eq 0) {
    $localBranchExists = $true
}

$remoteBranchExists = $false
$remoteOutput = @(& git -C $repoRoot ls-remote --exit-code --heads origin "refs/heads/$branch" 2>$null)
if ($LASTEXITCODE -eq 0 -and $remoteOutput.Count -gt 0) {
    $remoteBranchExists = $true
}

$mode = "new-from-base"
if ($localBranchExists) {
    $mode = "existing-local-branch"
}
elseif ($remoteBranchExists) {
    $mode = "track-remote-branch"
}

if (-not $DryRun) {
    if (-not (Test-Path -LiteralPath $WorktreeRoot)) {
        New-Item -ItemType Directory -Path $WorktreeRoot -Force | Out-Null
    }

    if ($localBranchExists) {
        Invoke-GitChecked -Arguments @("worktree", "add", $targetPath, $branch) | Out-Null
    }
    elseif ($remoteBranchExists) {
        Invoke-GitChecked -Arguments @("worktree", "add", "--track", "-b", $branch, $targetPath, "origin/$branch") | Out-Null
    }
    else {
        Invoke-GitChecked -Arguments @("worktree", "add", "-b", $branch, $targetPath, $BaseRef) | Out-Null
    }
}

$result = [pscustomobject]@{
    status = $(if ($DryRun) { "dry-run" } else { "created" })
    mode = $mode
    branch = $branch
    baseRef = $BaseRef
    worktree = $targetPath
}
if ($Json) { $result | ConvertTo-Json -Compress } else { $result | Format-List }
