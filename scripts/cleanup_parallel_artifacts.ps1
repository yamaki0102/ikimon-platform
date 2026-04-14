param(
    [string]$RepoPath = 'E:\Projects\Playground'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $RepoPath)) {
    throw "RepoPath not found: $RepoPath"
}

$worktrees = @(
    'E:\Projects\Playground_codex',
    'E:\Projects\Playground_claude'
)

foreach ($wt in $worktrees) {
    if (Test-Path -LiteralPath $wt) {
        & git -C $RepoPath worktree remove $wt --force
    }
}

$stagingClone = 'E:\Projects\_staging\Playground_clone_test'
if (Test-Path -LiteralPath $stagingClone) {
    Remove-Item -LiteralPath $stagingClone -Recurse -Force
}

Write-Host ''
Write-Host 'Remaining Playground paths:'
Get-ChildItem -Force 'E:\Projects' | Where-Object { $_.Name -like 'Playground*' } | Select-Object Name, FullName
