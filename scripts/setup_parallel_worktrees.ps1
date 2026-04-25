param(
    [string]$RepoPath = 'E:\Projects\Playground',
    [string]$CodexBranch = 'codex/playground-parallel',
    [string]$ClaudeBranch = 'claude/playground-parallel'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $RepoPath)) {
    throw "RepoPath not found: $RepoPath"
}

$repoName = Split-Path -Leaf $RepoPath
$repoParent = Split-Path -Parent $RepoPath

$codexPath = Join-Path $repoParent ($repoName + '_codex')
$claudePath = Join-Path $repoParent ($repoName + '_claude')

Write-Host "Main repo   : $RepoPath"
Write-Host "Codex tree  : $codexPath"
Write-Host "Claude tree : $claudePath"

& git -C $RepoPath rev-parse --is-inside-work-tree | Out-Null

if (-not (Test-Path -LiteralPath $codexPath)) {
    & git -C $RepoPath worktree add $codexPath -b $CodexBranch
} else {
    Write-Host "Skip Codex worktree; already exists."
}

if (-not (Test-Path -LiteralPath $claudePath)) {
    & git -C $RepoPath worktree add $claudePath -b $ClaudeBranch
} else {
    Write-Host "Skip Claude worktree; already exists."
}

Write-Host ''
Write-Host 'Current worktrees:'
& git -C $RepoPath worktree list
