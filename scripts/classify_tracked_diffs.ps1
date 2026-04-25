param(
    [string]$RepoPath = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $RepoPath)) {
    throw "RepoPath not found: $RepoPath"
}

& git -C $RepoPath rev-parse --is-inside-work-tree | Out-Null

$allTracked = @(
    & git -C $RepoPath -c core.quotepath=off diff --name-only
) | Where-Object { $_ } | Sort-Object -Unique

$substantive = @(
    & git -C $RepoPath -c core.quotepath=off diff --ignore-space-at-eol --name-only
) | Where-Object { $_ } | Sort-Object -Unique

$substantiveSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
foreach ($path in $substantive) {
    [void]$substantiveSet.Add($path)
}

$lineEndingOnly = foreach ($path in $allTracked) {
    if (-not $substantiveSet.Contains($path)) {
        $path
    }
}

Write-Host "Tracked diff files : $($allTracked.Count)"
Write-Host "Substantive diffs  : $($substantive.Count)"
Write-Host "Line-ending-only   : $($lineEndingOnly.Count)"

if ($substantive.Count -gt 0) {
    Write-Host ''
    Write-Host 'Substantive diff files:'
    $substantive | ForEach-Object { Write-Host "  $_" }
}

if ($lineEndingOnly.Count -gt 0) {
    Write-Host ''
    Write-Host 'Line-ending-only diff files:'
    $lineEndingOnly | ForEach-Object { Write-Host "  $_" }
}
