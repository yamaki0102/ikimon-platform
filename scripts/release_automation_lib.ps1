Set-StrictMode -Version 2.0

function ConvertTo-ReleaseTaskName {
    param([Parameter(Mandatory = $true)][string]$TaskName)

    $raw = $TaskName.Trim().ToLowerInvariant()
    if ($raw.Contains("/")) {
        throw "TaskName must not contain '/'."
    }

    $slug = [regex]::Replace($raw, "[^a-z0-9-]+", "-")
    $slug = [regex]::Replace($slug, "-+", "-").Trim("-")
    if ($slug.Length -lt 2 -or $slug.Length -gt 50 -or $slug -notmatch "^[a-z0-9][a-z0-9-]*[a-z0-9]$") {
        throw "TaskName must normalize to 2-50 lowercase letters, numbers, or hyphens."
    }

    return $slug
}

function Get-RepositorySlug {
    param([Parameter(Mandatory = $true)][string]$RemoteUrl)

    $value = $RemoteUrl.Trim()
    $match = [regex]::Match($value, "github\.com[/:](?<owner>[^/]+?)/(?<repo>[^/]+?)(?:\.git)?$")
    if (-not $match.Success) {
        throw "origin must be a GitHub repository URL."
    }

    $owner = $match.Groups["owner"].Value
    $repo = $match.Groups["repo"].Value
    if ($repo.EndsWith(".git")) {
        $repo = $repo.Substring(0, $repo.Length - 4)
    }
    return "$owner/$repo"
}

function Get-DefaultReleaseWorktreeRoot {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [string[]]$WorktreeLines
    )

    [string[]]$lines = @($WorktreeLines)
    if ($null -eq $lines -or @($lines).Count -eq 0) {
        [string[]]$lines = @(& git -C $RepoRoot worktree list --porcelain 2>$null)
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to list Git worktrees."
        }
    }

    $candidateParents = New-Object System.Collections.Generic.List[string]
    foreach ($line in $lines) {
        if ($line -notmatch "^worktree\s+(.+)$") {
            continue
        }
        $path = $matches[1]
        $parent = Split-Path -Parent $path
        if ((Split-Path -Leaf $parent) -eq "worktrees" -and $parent -notmatch "[\\/]_agent_scratch[\\/]") {
            $candidateParents.Add($parent)
        }
    }

    if ($candidateParents.Count -gt 0) {
        return ($candidateParents | Group-Object | Sort-Object Count -Descending | Select-Object -First 1).Name
    }

    $repoParent = Split-Path -Parent $RepoRoot
    return (Join-Path $repoParent "worktrees")
}

function Get-RequiredChecksState {
    param(
        [Parameter(Mandatory = $true)][string[]]$RequiredContexts,
        [object[]]$Rollup = @()
    )

    $successConclusions = @("SUCCESS", "NEUTRAL", "SKIPPED")
    $failedConclusions = @("FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE", "STALE")
    $pending = New-Object System.Collections.Generic.List[string]
    $failed = New-Object System.Collections.Generic.List[string]

    foreach ($context in $RequiredContexts) {
        $matches = @($Rollup | Where-Object {
            $nameProperty = $_.PSObject.Properties["name"]
            $contextProperty = $_.PSObject.Properties["context"]
            ($nameProperty -and [string]$nameProperty.Value -eq $context) -or
                ($contextProperty -and [string]$contextProperty.Value -eq $context)
        })
        if ($matches.Count -eq 0) {
            $pending.Add($context)
            continue
        }

        $check = $matches | Sort-Object {
            $timestamp = $null
            foreach ($propertyName in @("completedAt", "completed_at", "updatedAt", "updated_at", "startedAt", "started_at")) {
                $property = $_.PSObject.Properties[$propertyName]
                if ($property -and -not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
                    try {
                        $timestamp = [datetimeoffset]::Parse([string]$property.Value).UtcDateTime
                    }
                    catch {
                        $timestamp = $null
                    }
                    if ($timestamp) { break }
                }
            }
            if ($timestamp) { $timestamp } else { [datetime]::MinValue }
        } -Descending | Select-Object -First 1
        $statusProperty = $check.PSObject.Properties["status"]
        $conclusionProperty = $check.PSObject.Properties["conclusion"]
        $stateProperty = $check.PSObject.Properties["state"]
        $status = $(if ($statusProperty) { ([string]$statusProperty.Value).ToUpperInvariant() } else { "" })
        $conclusion = $(if ($conclusionProperty) { ([string]$conclusionProperty.Value).ToUpperInvariant() } else { "" })
        $contextState = $(if ($stateProperty) { ([string]$stateProperty.Value).ToUpperInvariant() } else { "" })
        if ($successConclusions -contains $contextState) {
            continue
        }
        elseif ($failedConclusions -contains $contextState -or $contextState -eq "ERROR") {
            $failed.Add($context)
        }
        elseif (-not [string]::IsNullOrWhiteSpace($contextState)) {
            $pending.Add($context)
        }
        elseif ($status -ne "COMPLETED" -and $status -ne "SUCCESS") {
            $pending.Add($context)
        }
        elseif ($successConclusions -contains $conclusion -or ($status -eq "SUCCESS" -and [string]::IsNullOrWhiteSpace($conclusion))) {
            continue
        }
        elseif ($failedConclusions -contains $conclusion) {
            $failed.Add($context)
        }
        else {
            $pending.Add($context)
        }
    }

    $state = "ready"
    if ($failed.Count -gt 0) {
        $state = "failed"
    }
    elseif ($pending.Count -gt 0) {
        $state = "pending"
    }

    return [pscustomobject]@{
        state = $state
        pending = @($pending)
        failed = @($failed)
    }
}

function Test-RequiresCloudflareStaging {
    param([Parameter(Mandatory = $true)][string[]]$ChangedPaths)

    foreach ($rawPath in $ChangedPaths) {
        $path = ([string]$rawPath).Replace("\", "/")
        if ($path -eq ".github/workflows/deploy-cloudflare-staging.yml" -or
            $path.StartsWith(".github/actions/setup-platform-browser/") -or
            $path.StartsWith("platform_v2/cloudflare_shadow/") -or
            $path.StartsWith("platform_v2/e2e/") -or
            $path.StartsWith("platform_v2/src/") -or
            $path -eq "platform_v2/playwright.staging.config.ts" -or
            $path -eq "platform_v2/package.json" -or
            $path -eq "platform_v2/package-lock.json") {
            return $true
        }
    }

    return $false
}

function Test-AddedLinesForSecrets {
    param([Parameter(Mandatory = $true)][string[]]$DiffLines)

    $patterns = @(
        @{ Kind = "private-key"; Regex = "-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----" },
        @{ Kind = "github-token"; Regex = "\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b" },
        @{ Kind = "openai-key"; Regex = "\bsk-[A-Za-z0-9_-]{20,}\b" },
        @{ Kind = "google-api-key"; Regex = "\bAIza[0-9A-Za-z_-]{30,}\b" },
        @{ Kind = "aws-access-key"; Regex = "\bAKIA[0-9A-Z]{16}\b" },
        @{ Kind = "slack-token"; Regex = "\bxox[baprs]-[A-Za-z0-9-]{20,}\b" }
    )

    $findings = New-Object System.Collections.Generic.List[object]
    for ($index = 0; $index -lt $DiffLines.Count; $index++) {
        $line = [string]$DiffLines[$index]
        if (-not $line.StartsWith("+") -or $line.StartsWith("+++")) {
            continue
        }
        foreach ($pattern in $patterns) {
            if ($line -match $pattern.Regex) {
                $findings.Add([pscustomobject]@{
                    kind = $pattern.Kind
                    diffLine = $index + 1
                })
                break
            }
        }
    }

    return [object[]]$findings.ToArray()
}

function Get-StagingRunDecision {
    param(
        [object[]]$Runs = @(),
        [Parameter(Mandatory = $true)][string]$TargetSha,
        [switch]$RetryFailed
    )

    $latest = @($Runs | Sort-Object { [datetime]$_.createdAt } -Descending | Select-Object -First 1)
    if ($latest.Count -eq 0) {
        return [pscustomobject]@{ action = "dispatch"; run = $null; reason = "no-run" }
    }

    $run = $latest[0]
    if (-not ([string]$run.displayTitle).Contains("target=$TargetSha")) {
        return [pscustomobject]@{ action = "dispatch"; run = $run; reason = "staging-overwritten" }
    }
    if ($run.status -ne "completed") {
        return [pscustomobject]@{ action = "wait"; run = $run; reason = "target-running" }
    }
    if ($run.conclusion -eq "success") {
        return [pscustomobject]@{ action = "reuse"; run = $run; reason = "target-current" }
    }
    if ($RetryFailed) {
        return [pscustomobject]@{ action = "dispatch"; run = $run; reason = "retry-failed" }
    }
    return [pscustomobject]@{ action = "block"; run = $run; reason = "target-failed" }
}
