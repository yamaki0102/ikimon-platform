param(
    [string]$RepoPath = (Split-Path -Parent $PSScriptRoot),
    [switch]$Fix
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $RepoPath)) {
    throw "RepoPath not found: $RepoPath"
}

& git -C $RepoPath rev-parse --is-inside-work-tree | Out-Null

$trackedLocalProps = @(
    & git -C $RepoPath -c core.quotepath=off ls-files '*local.properties'
) | Where-Object { $_ }

$eolOutput = & git -C $RepoPath -c core.quotepath=off ls-files --eol
$crlfViolations = @()

foreach ($line in $eolOutput) {
    $parts = $line -split "`t", 2
    if ($parts.Count -ne 2) {
        continue
    }

    $meta = $parts[0]
    $path = $parts[1].Trim()

    if ($meta -notmatch '^i/(?<index>\S+)\s+w/(?<worktree>\S+)\s+attr/(?<attr>.+)$') {
        continue
    }

    $worktree = $Matches['worktree']
    $attr = $Matches['attr']

    if ($attr -match 'eol=lf' -and $worktree -eq 'crlf') {
        $crlfViolations += [pscustomobject]@{
            Path = $path
            Attr = $attr
            Worktree = $worktree
        }
    }
}

$worktreeDir = Join-Path $RepoPath '.git\worktrees'
$hasGitWorktrees = Test-Path -LiteralPath $worktreeDir

if ($Fix -and $crlfViolations) {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    foreach ($item in $crlfViolations) {
        $fullPath = Join-Path $RepoPath $item.Path
        if (-not (Test-Path -LiteralPath $fullPath)) {
            throw "Path not found during LF normalization: $fullPath"
        }
        $content = [System.IO.File]::ReadAllText($fullPath)
        $normalized = $content.Replace("`r`n", "`n")
        [System.IO.File]::WriteAllBytes($fullPath, $utf8.GetBytes($normalized))
    }

    $eolOutput = & git -C $RepoPath -c core.quotepath=off ls-files --eol
    $crlfViolations = @()
    foreach ($line in $eolOutput) {
        $parts = $line -split "`t", 2
        if ($parts.Count -ne 2) {
            continue
        }

        $meta = $parts[0]
        $path = $parts[1].Trim()

        if ($meta -notmatch '^i/(?<index>\S+)\s+w/(?<worktree>\S+)\s+attr/(?<attr>.+)$') {
            continue
        }

        $worktree = $Matches['worktree']
        $attr = $Matches['attr']

        if ($attr -match 'eol=lf' -and $worktree -eq 'crlf') {
            $crlfViolations += [pscustomobject]@{
                Path = $path
                Attr = $attr
                Worktree = $worktree
            }
        }
    }
}

if (-not $trackedLocalProps -and -not $crlfViolations -and -not $hasGitWorktrees) {
    Write-Host 'Shared-root hygiene OK.'
    exit 0
}

if ($trackedLocalProps) {
    Write-Host 'Tracked local.properties files:'
    $trackedLocalProps | ForEach-Object { Write-Host "  $_" }
}

if ($crlfViolations) {
    Write-Host 'CRLF working-tree violations on LF-sensitive files:'
    foreach ($item in $crlfViolations) {
        Write-Host "  $($item.Path) (attr=$($item.Attr), worktree=$($item.Worktree))"
    }
}

if ($hasGitWorktrees) {
    Write-Host "Residual git worktrees directory detected: $worktreeDir"
}

exit 1
