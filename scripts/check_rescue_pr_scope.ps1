param(
    [string]$BaseRef = 'origin/main',
    [int]$MaxFiles = 12,
    [int]$MaxFileGroups = 1,
    [switch]$Fetch,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & git @Args
}

function Get-FileGroup {
    param([string]$Path)

    $normalized = $Path -replace '\\', '/'
    $parts = @($normalized -split '/' | Where-Object { $_ -ne '' })
    if ($parts.Count -eq 0) {
        return '(root)'
    }

    switch ($parts[0]) {
        'platform_v2' {
            if ($parts.Count -ge 3) {
                return ($parts[0..2] -join '/')
            }
            return ($parts[0..($parts.Count - 1)] -join '/')
        }
        'upload_package' {
            if ($parts.Count -ge 3) {
                return ($parts[0..2] -join '/')
            }
            return ($parts[0..($parts.Count - 1)] -join '/')
        }
        '.github' {
            if ($parts.Count -ge 2) {
                return ($parts[0..1] -join '/')
            }
            return '.github'
        }
        default {
            return $parts[0]
        }
    }
}

function Test-RescueSignal {
    param([string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $false
    }

    return $Text -match '(?i)(\brescue\b|\bsalvage\b|\brebuild\b|split\s+from|from\s+#\d+|replaces\s+.*#\d+|旧PR|救出|出し直し|置き換え|切り出し)'
}

$signalText = @(
    $env:PR_TITLE,
    $env:PR_BODY
) -join "`n"

if (-not $Force -and -not (Test-RescueSignal $signalText)) {
    Write-Host 'Rescue PR scope guard skipped: no rescue/rebuild signal found in PR title or body.'
    exit 0
}

Invoke-Git 'rev-parse' '--is-inside-work-tree' | Out-Null

if ($Fetch) {
    Invoke-Git 'fetch' 'origin' '--prune' | Out-Null
}

Invoke-Git 'rev-parse' '--verify' $BaseRef | Out-Null

$changedFiles = @(
    Invoke-Git 'diff' '--name-only' "${BaseRef}...HEAD"
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

$fileGroups = @($changedFiles | ForEach-Object { Get-FileGroup $_ } | Sort-Object -Unique)

Write-Host "Rescue PR scope guard active."
Write-Host "BaseRef: $BaseRef"
Write-Host "Changed files: $($changedFiles.Count)"
Write-Host "File groups: $($fileGroups -join ', ')"

$errors = [System.Collections.Generic.List[string]]::new()
if ($changedFiles.Count -eq 0) {
    $errors.Add('No changed files found; rescue PR scope cannot be evaluated.') | Out-Null
}
if ($changedFiles.Count -gt $MaxFiles) {
    $errors.Add("Changed file count $($changedFiles.Count) exceeds MaxFiles=$MaxFiles.") | Out-Null
}
if ($fileGroups.Count -gt $MaxFileGroups) {
    $errors.Add("Changed file groups $($fileGroups.Count) exceeds MaxFileGroups=$MaxFileGroups.") | Out-Null
}

if ($errors.Count -gt 0) {
    Write-Host ''
    Write-Host 'Rescue PR scope guard failed:'
    foreach ($errorMessage in $errors) {
        Write-Host "  - $errorMessage"
    }
    Write-Host ''
    Write-Host 'Changed files:'
    foreach ($path in $changedFiles) {
        Write-Host "  - $path"
    }
    exit 2
}

Write-Host 'Rescue PR scope guard passed.'
