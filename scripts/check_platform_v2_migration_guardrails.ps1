param(
    [string]$BaseRef = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Get-DefaultBaseRef {
    if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_BASE_REF)) {
        return "origin/$($env:GITHUB_BASE_REF)"
    }

    if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_EVENT_BEFORE) -and
        $env:GITHUB_EVENT_BEFORE -notmatch '^0+$') {
        return $env:GITHUB_EVENT_BEFORE
    }

    $headParent = git -C $repoRoot rev-parse --verify HEAD~1 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($headParent)) {
        return "HEAD~1"
    }

    return ""
}

function Get-ChangedMigrationFiles {
    param([string]$ResolvedBaseRef)

    $files = New-Object System.Collections.Generic.HashSet[string]

    if (-not [string]::IsNullOrWhiteSpace($ResolvedBaseRef)) {
        $diffArgs = @("diff", "--name-only", "--diff-filter=AM", "$ResolvedBaseRef...HEAD", "--", "platform_v2/db/migrations/*.sql")
        $diffFiles = git -C $repoRoot @diffArgs 2>$null
        if ($LASTEXITCODE -ne 0) {
            $diffArgs = @("diff", "--name-only", "--diff-filter=AM", "$ResolvedBaseRef..HEAD", "--", "platform_v2/db/migrations/*.sql")
            $diffFiles = git -C $repoRoot @diffArgs 2>$null
        }

        if ($LASTEXITCODE -eq 0) {
            foreach ($file in @($diffFiles)) {
                if (-not [string]::IsNullOrWhiteSpace($file)) {
                    [void]$files.Add($file.Trim())
                }
            }
        }
    }

    $statusFiles = git -C $repoRoot status --short -- "platform_v2/db/migrations/*.sql" 2>$null
    if ($LASTEXITCODE -eq 0) {
        foreach ($line in @($statusFiles)) {
            if ($line.Length -lt 4) { continue }
            $pathPart = $line.Substring(3).Trim()
            if ($pathPart.Contains(" -> ")) {
                $pathPart = ($pathPart -split " -> ")[-1]
            }
            if (-not [string]::IsNullOrWhiteSpace($pathPart)) {
                [void]$files.Add($pathPart)
            }
        }
    }

    return @($files)
}

function Normalize-TableName {
    param([string]$Raw)

    $name = $Raw.Trim().Trim('"').Trim()
    if ($name.Contains(".")) {
        $name = ($name -split "\.")[-1].Trim('"')
    }
    return $name.ToLowerInvariant()
}

function Get-RegexMatches {
    param(
        [string]$Text,
        [string]$Pattern
    )

    return [System.Text.RegularExpressions.Regex]::Matches(
        $Text,
        $Pattern,
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor
            [System.Text.RegularExpressions.RegexOptions]::Multiline
    )
}

$resolvedBaseRef = if ([string]::IsNullOrWhiteSpace($BaseRef)) { Get-DefaultBaseRef } else { $BaseRef }
$migrationFiles = Get-ChangedMigrationFiles -ResolvedBaseRef $resolvedBaseRef

if ($migrationFiles.Count -eq 0) {
    Write-Output "Platform v2 migration guardrails passed: no changed migrations."
    $global:LASTEXITCODE = 0
    exit 0
}

$destructivePatterns = @(
    @{ Pattern = '\bdrop\s+table\b'; Label = 'DROP TABLE' },
    @{ Pattern = '\bdrop\s+column\b'; Label = 'DROP COLUMN' },
    @{ Pattern = '\btruncate\b'; Label = 'TRUNCATE' },
    @{ Pattern = '\bdelete\s+from\b'; Label = 'DELETE FROM' },
    @{ Pattern = '^\s*update\b'; Label = 'UPDATE' }
)

$issues = New-Object System.Collections.Generic.List[string]

foreach ($relPath in $migrationFiles) {
    $fullPath = Join-Path $repoRoot $relPath
    if (-not (Test-Path $fullPath)) { continue }

    $sql = Get-Content -Raw -Path $fullPath
    $hasDestructiveOverride = $sql -match 'destructive-ok:\s*.{12,}'
    foreach ($entry in $destructivePatterns) {
        if (($sql -match $entry.Pattern) -and -not $hasDestructiveOverride) {
            $issues.Add("${relPath}: destructive migration pattern detected: $($entry.Label)")
        }
    }

    $createdTables = New-Object System.Collections.Generic.HashSet[string]
    foreach ($match in Get-RegexMatches -Text $sql -Pattern '\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([A-Za-z0-9_."-]+)') {
        [void]$createdTables.Add((Normalize-TableName $match.Groups[1].Value))
    }

    $hasOwnerSensitiveOverride = $sql -match 'owner-sensitive-ok:\s*.{12,}'
    foreach ($match in Get-RegexMatches -Text $sql -Pattern '^\s*alter\s+table\s+(?:if\s+exists\s+)?([A-Za-z0-9_."-]+)') {
        $tableName = Normalize-TableName $match.Groups[1].Value
        if ($createdTables.Contains($tableName)) {
            continue
        }
        if ($hasOwnerSensitiveOverride) {
            continue
        }

        $issues.Add(
            "${relPath}: ALTER TABLE $tableName may fail under staging/prod app DB roles. Prefer a companion table, or add an explicit 'owner-sensitive-ok: <rollback/deploy note>' comment."
        )
    }
}

if ($issues.Count -gt 0) {
    foreach ($issue in $issues) {
        Write-Error $issue
    }
    exit 1
}

Write-Output "Platform v2 migration guardrails passed: $($migrationFiles.Count) changed migration(s)."
$global:LASTEXITCODE = 0
exit 0
