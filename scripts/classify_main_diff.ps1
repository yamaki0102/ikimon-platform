param(
    [string]$RepoPath = (Split-Path -Parent $PSScriptRoot),
    [string]$BaseRef = 'origin/main',
    [switch]$Fetch,
    [switch]$Json,
    [switch]$FailOnMeaningfulDiff
)

$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & git -C $RepoPath @Args
}

function Test-BasePath {
    param([string]$Path)
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & git -C $RepoPath 'cat-file' '-e' "${BaseRef}:$Path" 2>$null
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    return $exitCode -eq 0
}

function Get-BaseBlob {
    param([string]$Path)
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $blob = & git -C $RepoPath 'rev-parse' "${BaseRef}:$Path" 2>$null
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    if ($exitCode -ne 0) {
        return $null
    }
    return ($blob | Select-Object -First 1)
}

function Get-WorktreeBlob {
    param([string]$Path)
    $fullPath = Join-Path $RepoPath $Path
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        return $null
    }
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $blob = & git -C $RepoPath 'hash-object' '--' $Path 2>$null
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    if ($exitCode -ne 0) {
        return $null
    }
    return ($blob | Select-Object -First 1)
}

function Add-Item {
    param(
        [System.Collections.Generic.List[object]]$List,
        [string]$Category,
        [string]$Status,
        [string]$Path,
        [string]$Reason
    )

    $List.Add([pscustomobject]@{
        Category = $Category
        Status = $Status
        Path = $Path
        Reason = $Reason
    }) | Out-Null
}

function ConvertFrom-GitStatusPath {
    param([string]$Path)

    if ($Path.Length -ge 2 -and $Path.StartsWith('"') -and $Path.EndsWith('"')) {
        $Path = $Path.Substring(1, $Path.Length - 2)
        $Path = $Path.Replace('\"', '"').Replace('\\', '\')
        $Path = $Path.Replace('\t', "`t").Replace('\n', "`n").Replace('\r', "`r")
    }

    return $Path
}

if (-not (Test-Path -LiteralPath $RepoPath)) {
    throw "RepoPath not found: $RepoPath"
}

Invoke-Git 'rev-parse' '--is-inside-work-tree' | Out-Null

if ($Fetch) {
    Invoke-Git 'fetch' 'origin' '--prune' | Out-Null
}

Invoke-Git 'rev-parse' '--verify' $BaseRef | Out-Null

$branch = (Invoke-Git 'branch' '--show-current' | Select-Object -First 1)
$head = (Invoke-Git 'rev-parse' '--short' 'HEAD' | Select-Object -First 1)
$base = (Invoke-Git 'rev-parse' '--short' $BaseRef | Select-Object -First 1)
$aheadBehind = (Invoke-Git 'rev-list' '--left-right' '--count' "${BaseRef}...HEAD" | Select-Object -First 1) -split '\s+'
$behind = [int]$aheadBehind[0]
$ahead = [int]$aheadBehind[1]

$entries = @(
    Invoke-Git '-c' 'core.quotepath=off' 'status' '--porcelain=v1' '-uall'
) | Where-Object { $_ }

$stale = [System.Collections.Generic.List[object]]::new()
$meaningful = [System.Collections.Generic.List[object]]::new()
$newUntracked = [System.Collections.Generic.List[object]]::new()
$deletions = [System.Collections.Generic.List[object]]::new()

foreach ($entry in $entries) {
    if ($entry.Length -lt 4) {
        continue
    }

    $status = $entry.Substring(0, 2)
    $path = $entry.Substring(3)
    if ($path.Contains(' -> ')) {
        $path = ($path -split ' -> ', 2)[1]
    }
    $path = ConvertFrom-GitStatusPath $path

    $baseExists = Test-BasePath $path
    $baseBlob = if ($baseExists) { Get-BaseBlob $path } else { $null }
    $worktreeBlob = Get-WorktreeBlob $path
    $isUntracked = $status -eq '??'
    $isDeleted = $status.Contains('D') -and -not $worktreeBlob

    if ($isUntracked) {
        if ($baseExists -and $worktreeBlob -eq $baseBlob) {
            Add-Item $stale 'stale_residue' $status $path 'untracked file matches base exactly'
        } elseif ($baseExists) {
            Add-Item $meaningful 'untracked_differs_from_base' $status $path 'untracked file exists in base but content differs'
        } else {
            Add-Item $newUntracked 'new_untracked' $status $path 'path does not exist in base'
        }
        continue
    }

    if ($isDeleted) {
        if ($baseExists) {
            Add-Item $deletions 'deleted_from_base' $status $path 'base has this file but worktree deletes it'
        } else {
            Add-Item $stale 'matches_base_absence' $status $path 'base also lacks this path'
        }
        continue
    }

    if ($baseExists -and $worktreeBlob -eq $baseBlob) {
        Add-Item $stale 'stale_residue' $status $path 'tracked change matches base exactly'
    } elseif ($baseExists) {
        Add-Item $meaningful 'differs_from_base' $status $path 'tracked file differs from base'
    } else {
        Add-Item $meaningful 'new_tracked' $status $path 'tracked path does not exist in base'
    }
}

$result = [pscustomobject]@{
    RepoPath = (Resolve-Path -LiteralPath $RepoPath).Path
    Branch = $branch
    Head = $head
    BaseRef = $BaseRef
    Base = $base
    Ahead = $ahead
    Behind = $behind
    Counts = [pscustomobject]@{
        StatusEntries = $entries.Count
        StaleResidue = $stale.Count
        Meaningful = $meaningful.Count
        NewUntracked = $newUntracked.Count
        Deletions = $deletions.Count
    }
    StaleResidue = $stale
    Meaningful = $meaningful
    NewUntracked = $newUntracked
    Deletions = $deletions
}

if ($Json) {
    $result | ConvertTo-Json -Depth 5
} else {
    Write-Host "Repo   : $($result.RepoPath)"
    Write-Host "Branch : $branch ($head)"
    Write-Host "Base   : $BaseRef ($base)"
    Write-Host "Ahead  : $ahead"
    Write-Host "Behind : $behind"
    Write-Host ''
    Write-Host "Status entries : $($entries.Count)"
    Write-Host "Stale residue  : $($stale.Count)"
    Write-Host "Meaningful     : $($meaningful.Count)"
    Write-Host "New untracked  : $($newUntracked.Count)"
    Write-Host "Deletions      : $($deletions.Count)"

    $groups = @(
        @{ Name = 'Stale residue matching base'; Items = $stale },
        @{ Name = 'Meaningful diffs vs base'; Items = $meaningful },
        @{ Name = 'New untracked paths'; Items = $newUntracked },
        @{ Name = 'Deletions vs base'; Items = $deletions }
    )

    foreach ($group in $groups) {
        if ($group.Items.Count -eq 0) {
            continue
        }

        Write-Host ''
        Write-Host "$($group.Name):"
        foreach ($item in $group.Items) {
            Write-Host ("  [{0}] {1} - {2}" -f $item.Status, $item.Path, $item.Reason)
        }
    }
}

if ($FailOnMeaningfulDiff -and (($meaningful.Count + $newUntracked.Count + $deletions.Count) -gt 0)) {
    exit 2
}
