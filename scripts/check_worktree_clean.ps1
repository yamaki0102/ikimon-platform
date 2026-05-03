param(
    [switch]$AllowUntracked,
    [switch]$RequireCodexBranch,
    [switch]$RequireUpstreamSync
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Write-Failure {
    param([string]$Message)

    [Console]::Error.WriteLine($Message)
}

function Get-GitOutput {
    param([string[]]$GitArgs)

    $output = & git -C $repoRoot @GitArgs 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed"
    }

    return @($output)
}

function Get-StatusPath {
    param([string]$Line)

    if ($Line.Length -lt 4) {
        return ""
    }

    $pathPart = $Line.Substring(3).Trim()
    if ($pathPart.Contains(" -> ")) {
        $pathPart = ($pathPart -split " -> ")[-1]
    }

    return $pathPart
}

$branch = (Get-GitOutput -GitArgs @("branch", "--show-current") | Select-Object -First 1)
if ([string]::IsNullOrWhiteSpace($branch)) {
    $branch = "(detached HEAD)"
}

$headSha = (Get-GitOutput -GitArgs @("rev-parse", "--short", "HEAD") | Select-Object -First 1)
$issues = New-Object System.Collections.Generic.List[string]

if ($RequireCodexBranch -and $branch -notlike "codex/*") {
    $issues.Add("Current branch must be codex/* before deploy handoff. Current branch: $branch")
}

if ($RequireUpstreamSync) {
    $upstream = & git -C $repoRoot rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($upstream)) {
        $issues.Add("Current branch has no upstream. Push it before deploy handoff.")
    }
    else {
        $counts = (Get-GitOutput -GitArgs @("rev-list", "--left-right", "--count", "HEAD...@{u}") | Select-Object -First 1)
        $parts = @($counts -split "\s+" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        if ($parts.Count -ge 2) {
            $ahead = [int]$parts[0]
            $behind = [int]$parts[1]
            if ($ahead -gt 0 -or $behind -gt 0) {
                $issues.Add("Current branch is not synced with upstream $upstream (ahead=$ahead, behind=$behind).")
            }
        }
    }
}

$statusArgs = @("status", "--porcelain=v1")
if ($AllowUntracked) {
    $statusArgs += "-uno"
}
else {
    $statusArgs += "-uall"
}

$statusLines = Get-GitOutput -GitArgs $statusArgs | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

$highRiskPatterns = @(
    @{ Pattern = ".github/workflows/*"; Label = "GitHub Actions workflow" },
    @{ Pattern = ".github/actions/*"; Label = "GitHub Actions composite action" },
    @{ Pattern = "platform_v2/db/migrations/*"; Label = "database migration" },
    @{ Pattern = "platform_v2/src/routes/*"; Label = "HTTP route" },
    @{ Pattern = "platform_v2/src/services/*"; Label = "service logic" },
    @{ Pattern = "ops/deploy/*"; Label = "deploy contract" },
    @{ Pattern = "scripts/check_*guardrail*.ps1"; Label = "deploy guardrail" },
    @{ Pattern = "upload_package/config/*"; Label = "legacy config/secrets boundary" },
    @{ Pattern = "upload_package/data/*"; Label = "persistent production data boundary" }
)

$highRiskLines = New-Object System.Collections.Generic.List[string]
foreach ($line in $statusLines) {
    $path = Get-StatusPath -Line $line
    if ([string]::IsNullOrWhiteSpace($path)) {
        continue
    }

    foreach ($entry in $highRiskPatterns) {
        if ($path -like $entry.Pattern) {
            $highRiskLines.Add("$path [$($entry.Label)]")
            break
        }
    }
}

if ($statusLines.Count -gt 0) {
    $issues.Add("Working tree is not clean. Commit, stash, or intentionally discard local changes before deploy handoff.")
}

if ($issues.Count -gt 0) {
    Write-Failure "Local worktree preflight failed for $branch@$headSha"
    foreach ($issue in $issues) {
        Write-Failure "ERROR: $issue"
    }

    if ($statusLines.Count -gt 0) {
        Write-Failure ""
        Write-Failure "Changed files:"
        foreach ($line in $statusLines) {
            Write-Failure "  $line"
        }
    }

    if ($highRiskLines.Count -gt 0) {
        Write-Failure ""
        Write-Failure "High-risk changed paths:"
        foreach ($line in $highRiskLines) {
            Write-Failure "  $line"
        }
    }

    exit 1
}

Write-Output "Worktree clean: $branch@$headSha"
$global:LASTEXITCODE = 0
exit 0
