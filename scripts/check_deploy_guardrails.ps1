param(
    [string]$ManifestPath = "ops/deploy/deploy_manifest.json"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestFullPath = if ([System.IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $repoRoot $ManifestPath }

if (-not (Test-Path $manifestFullPath)) {
    throw "Deploy manifest not found: $manifestFullPath"
}

$manifest = Get-Content -Raw -Path $manifestFullPath | ConvertFrom-Json

function Test-MatchAnyPattern {
    param(
        [string]$Path,
        [object[]]$Patterns
    )

    foreach ($pattern in $Patterns) {
        if ($Path -like $pattern) {
            return $true
        }
    }

    return $false
}

function Get-GitLines {
    param([string[]]$Args)

    try {
        $lines = git -C $repoRoot @Args 2>$null
        if ($LASTEXITCODE -ne 0) {
            return @()
        }
        return @($lines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }
    catch {
        return @()
    }
}

$trackedFiles = Get-GitLines -Args @("ls-files")
$statusLines = Get-GitLines -Args @("status", "--short")
$changedFiles = @()

foreach ($line in $statusLines) {
    if ($line.Length -lt 4) {
        continue
    }

    $pathPart = $line.Substring(3).Trim()
    if ($pathPart.Contains(" -> ")) {
        $pathPart = ($pathPart -split " -> ")[-1]
    }
    $changedFiles += $pathPart
}

$forbiddenTracked = @($trackedFiles | Where-Object { Test-MatchAnyPattern -Path $_ -Patterns $manifest.forbiddenPaths })
$forbiddenChanged = @($changedFiles | Where-Object { Test-MatchAnyPattern -Path $_ -Patterns $manifest.forbiddenPaths })
$persistentChanged = @($changedFiles | Where-Object { Test-MatchAnyPattern -Path $_ -Patterns $manifest.persistentPaths })

$issues = New-Object System.Collections.Generic.List[string]

if ($manifest.strategy -ne "github_actions_only") {
    $issues.Add("Unsupported deploy strategy in manifest: $($manifest.strategy)")
}

if ($forbiddenTracked.Count -gt 0) {
    $issues.Add("Forbidden files are tracked in git: " + ($forbiddenTracked -join ", "))
}

if ($forbiddenChanged.Count -gt 0) {
    $issues.Add("Forbidden deploy paths are changed in working tree: " + ($forbiddenChanged -join ", "))
}

if ($persistentChanged.Count -gt 0) {
    $issues.Add("Persistent production paths must not be modified here: " + ($persistentChanged -join ", "))
}

$deployJsonPath = Join-Path $repoRoot "deploy.json"
if (Test-Path $deployJsonPath) {
    $deployJson = Get-Content -Raw -Path $deployJsonPath | ConvertFrom-Json
    if ($deployJson.Mode -ne "github_actions_only") {
        $issues.Add("deploy.json must declare Mode=github_actions_only")
    }
}

if ($issues.Count -gt 0) {
    foreach ($issue in $issues) {
        Write-Error $issue
    }
    exit 1
}

Write-Output "Deploy guardrails passed."
