param(
    [string]$WorkspaceRoot = "E:\Projects\Playground",
    [switch]$Json
)

$ErrorActionPreference = "Stop"

$manifestPath = Join-Path $WorkspaceRoot "docs\architecture\legacy_write_inventory_manifest_2026-04-12.json"
if (-not (Test-Path $manifestPath)) {
    throw "Manifest not found: $manifestPath"
}

$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
$workspacePrefix = ($WorkspaceRoot.TrimEnd("\") + "\").ToLowerInvariant()
$knownFiles = @{}
foreach ($file in $manifest.knownWriteFiles) {
    $normalized = ($file -replace "\\", "/").ToLowerInvariant()
    $knownFiles[$normalized] = $true
}
$ignoredFiles = @{}
foreach ($file in $manifest.ignoredWriteFiles) {
    $normalized = ($file -replace "\\", "/").ToLowerInvariant()
    $ignoredFiles[$normalized] = $true
}
$ignorePatterns = @()
foreach ($pattern in $manifest.ignorePathPatterns) {
    $ignorePatterns += [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

$patterns = @($manifest.writePatterns)
$candidateMatches = New-Object System.Collections.Generic.List[object]

foreach ($root in $manifest.roots) {
    $absRoot = Join-Path $WorkspaceRoot $root
    if (-not (Test-Path $absRoot)) {
        continue
    }

    $files = Get-ChildItem -Path $absRoot -Recurse -File -Include *.php
    foreach ($file in $files) {
        $fullNameLower = $file.FullName.ToLowerInvariant()
        if ($fullNameLower.StartsWith($workspacePrefix)) {
            $relative = $file.FullName.Substring($workspacePrefix.Length) -replace "\\", "/"
        } else {
            $relative = $file.FullName -replace "\\", "/"
        }
        $relativeKey = $relative.ToLowerInvariant()
        if ($ignoredFiles.ContainsKey($relativeKey)) {
            continue
        }
        $ignored = $false
        foreach ($ignorePattern in $ignorePatterns) {
            if ($ignorePattern.IsMatch($relative)) {
                $ignored = $true
                break
            }
        }
        if ($ignored) {
            continue
        }
        foreach ($pattern in $patterns) {
            $match = Select-String -Path $file.FullName -Pattern $pattern -SimpleMatch:$false | Select-Object -First 1
            if ($null -ne $match) {
                $candidateMatches.Add([pscustomobject]@{
                    relativePath = $relative
                    lineNumber   = $match.LineNumber
                    pattern      = $pattern
                    known        = $knownFiles.ContainsKey($relativeKey)
                })
                break
            }
        }
    }
}

$missingKnownFiles = New-Object System.Collections.Generic.List[string]
foreach ($file in $manifest.knownWriteFiles) {
    $absPath = Join-Path $WorkspaceRoot $file
    if (-not (Test-Path $absPath)) {
        $missingKnownFiles.Add($file)
    }
}

$unknownCandidates = $candidateMatches | Where-Object { -not $_.known } | Sort-Object relativePath -Unique
$knownCandidates = $candidateMatches | Where-Object { $_.known } | Sort-Object relativePath -Unique

$report = [pscustomobject]@{
    status = if ($missingKnownFiles.Count -eq 0 -and $unknownCandidates.Count -eq 0) { "PASS" } else { "WARN" }
    manifestPath = $manifestPath
    summary = [pscustomobject]@{
        knownWriteFiles = $manifest.knownWriteFiles.Count
        knownCandidatesFound = $knownCandidates.Count
        unknownCandidatesFound = $unknownCandidates.Count
        missingKnownFiles = $missingKnownFiles.Count
    }
    missingKnownFiles = @($missingKnownFiles)
    unknownCandidates = @($unknownCandidates)
}

if ($Json) {
    $report | ConvertTo-Json -Depth 6
    exit 0
}

Write-Output ("status: {0}" -f $report.status)
Write-Output ("known candidates found: {0}" -f $report.summary.knownCandidatesFound)
Write-Output ("unknown candidates found: {0}" -f $report.summary.unknownCandidatesFound)
Write-Output ("missing known files: {0}" -f $report.summary.missingKnownFiles)

if ($missingKnownFiles.Count -gt 0) {
    Write-Output ""
    Write-Output "missing known files:"
    $missingKnownFiles | ForEach-Object { Write-Output ("- {0}" -f $_) }
}

if ($unknownCandidates.Count -gt 0) {
    Write-Output ""
    Write-Output "unknown candidates:"
    $unknownCandidates | ForEach-Object {
        Write-Output ("- {0}:{1} pattern={2}" -f $_.relativePath, $_.lineNumber, $_.pattern)
    }
}
