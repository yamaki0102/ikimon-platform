param(
    [string]$OutputPath = "docs/CATCHUP_SNAPSHOT.md",
    [string]$ManifestPath = "docs/catchup_manifest.json"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputFullPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $repoRoot $OutputPath }
$manifestFullPath = if ([System.IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $repoRoot $ManifestPath }
$trackedRelativePaths = @()

function Get-RelativePath {
    param([string]$BasePath, [string]$TargetPath)

    $baseFullPath = (Resolve-Path -LiteralPath $BasePath).Path.TrimEnd('\') + '\'
    $targetFullPath = (Resolve-Path -LiteralPath $TargetPath).Path
    $baseUri = [System.Uri]::new($baseFullPath)
    $targetUri = [System.Uri]::new($targetFullPath)

    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', '\')
}

function Get-NormalizedRelativePath {
    param([string]$Path)

    return $Path.Replace('\', '/').TrimStart('/')
}

function Get-TrackedFilePaths {
    param(
        [string]$Path,
        [string]$Filter = "*",
        [switch]$Recurse
    )

    $relativeRoot = Get-NormalizedRelativePath (Get-RelativePath -BasePath $repoRoot -TargetPath $Path)
    if ($relativeRoot -eq ".") {
        $relativeRoot = ""
    }
    $relativeRoot = $relativeRoot.TrimEnd('/')
    $prefix = if ([string]::IsNullOrWhiteSpace($relativeRoot)) { "" } else { "$relativeRoot/" }

    $matches = foreach ($relativePath in $trackedRelativePaths) {
        $normalizedPath = Get-NormalizedRelativePath $relativePath
        if ($prefix -and -not $normalizedPath.StartsWith($prefix, [System.StringComparison]::Ordinal)) {
            continue
        }

        if (-not $Recurse) {
            $remaining = if ($prefix) { $normalizedPath.Substring($prefix.Length) } else { $normalizedPath }
            if ($remaining.Contains('/')) {
                continue
            }
        }

        if ([System.IO.Path]::GetFileName($normalizedPath) -notlike $Filter) {
            continue
        }

        Join-Path $repoRoot $normalizedPath
    }

    return @($matches | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { Get-Item -LiteralPath $_ -Force })
}

function Get-FileList {
    param(
        [string]$Path,
        [string]$Filter = "*",
        [switch]$Recurse
    )

    if (-not (Test-Path $Path)) {
        return @()
    }

    return Get-TrackedFilePaths -Path $Path -Filter $Filter -Recurse:$Recurse
}

function Set-Utf8NoBomContent {
    param(
        [string]$Path,
        [string[]]$Value
    )

    $encoding = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, (($Value -join "`n") + "`n"), $encoding)
}

if (-not (Test-Path $manifestFullPath)) {
    throw "Manifest not found: $manifestFullPath"
}

$manifest = Get-Content -Raw -Path $manifestFullPath | ConvertFrom-Json
$excludedTopLevelDirectories = @($manifest.excludeTopLevelDirectories)
$excludedPathPrefixes = @($manifest.excludePathPrefixes)
$trackedRelativePaths = @(
    git -C $repoRoot ls-files |
        ForEach-Object { Get-NormalizedRelativePath $_ } |
        Where-Object {
            $path = $_
            @($excludedPathPrefixes | Where-Object { $path.StartsWith($_, [System.StringComparison]::Ordinal) }).Count -eq 0
        }
)

$trackedTopLevelDirectoryNames = $trackedRelativePaths |
    ForEach-Object { (Get-NormalizedRelativePath $_).Split('/')[0] } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and $_ -notin $excludedTopLevelDirectories } |
    Sort-Object -Unique

$topLevelDirectories = $trackedTopLevelDirectoryNames |
    ForEach-Object { Get-Item -LiteralPath (Join-Path $repoRoot $_) -Force -ErrorAction SilentlyContinue } |
    Where-Object { $_ -and $_.PSIsContainer } |
    Sort-Object Name

$lines = New-Object System.Collections.Generic.List[string]
$null = $lines.Add("# Catch-Up Snapshot")
$null = $lines.Add("")
$null = $lines.Add("Manifest: $ManifestPath (schema $($manifest.version))")
$null = $lines.Add("")
$null = $lines.Add("## Scale")
$null = $lines.Add("")
$null = $lines.Add("| Area | Count |")
$null = $lines.Add("|---|---:|")
$null = $lines.Add("| Top-level directories | $($topLevelDirectories.Count) |")
foreach ($scaleItem in @($manifest.scaleItems)) {
    $scaleRoot = Join-Path $repoRoot $scaleItem.path
    $scaleFiles = Get-FileList -Path $scaleRoot -Filter $scaleItem.filter -Recurse:([bool]$scaleItem.recurse)
    $null = $lines.Add("| $($scaleItem.label) | $($scaleFiles.Count) |")
}
$null = $lines.Add("")
$null = $lines.Add("Skipped support directories: " + ($excludedTopLevelDirectories -join ", "))
if ($excludedPathPrefixes.Count -gt 0) {
    $null = $lines.Add("Skipped nested path prefixes: " + ($excludedPathPrefixes -join ", "))
}
$null = $lines.Add("Refresh policy: structure change = $($manifest.refreshPolicy.runAfterStructureChange), review cadence = every $($manifest.refreshPolicy.reviewEveryMonths) months")
$null = $lines.Add("")
foreach ($section in $manifest.sections) {
    $null = $lines.Add("## $($section.title)")
    $null = $lines.Add("")

    switch ($section.mode) {
        "top_level_directories" {
            foreach ($directory in $topLevelDirectories) {
                $fileCount = (Get-TrackedFilePaths -Path $directory.FullName -Recurse | Measure-Object).Count
                $null = $lines.Add("- $($directory.Name)/ : $fileCount files")
            }
        }
        "directory_count" {
            $sectionRoot = Join-Path $repoRoot $section.path
            $directories = Get-ChildItem -Path $sectionRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name
            if ($directories.Count -eq 0) {
                $null = $lines.Add("- none")
            } else {
                foreach ($directory in $directories) {
                    $count = (Get-FileList -Path $directory.FullName -Filter $section.filter -Recurse | Measure-Object).Count
                    $sectionRelativePath = Get-RelativePath -BasePath $repoRoot -TargetPath $directory.FullName
                    $null = $lines.Add("- $sectionRelativePath/ : $count files")
                }
            }
        }
        "largest_files" {
            $sectionRoot = Join-Path $repoRoot $section.path
            $files = Get-FileList -Path $sectionRoot -Filter $section.filter -Recurse |
                Sort-Object Length -Descending |
                Select-Object -First $section.limit
            $null = $lines.Add("| File | Size KB |")
            $null = $lines.Add("|---|---:|")
            foreach ($file in $files) {
                $relativePath = Get-RelativePath -BasePath $repoRoot -TargetPath $file.FullName
                $sizeKb = [math]::Round($file.Length / 1KB, 1)
                $null = $lines.Add("| $relativePath | $sizeKb |")
            }
        }
        default {
            throw "Unsupported section mode: $($section.mode)"
        }
    }

    $null = $lines.Add("")
}

$null = $lines.Add("")
$null = $lines.Add("## Key Entry Points")
$null = $lines.Add("")
foreach ($entryPoint in $manifest.entryPoints) {
    $null = $lines.Add("- $($entryPoint.path) : $($entryPoint.role)")
}

$null = $lines.Add("")
$null = $lines.Add("## Maintenance Rules")
$null = $lines.Add("")
foreach ($watchItem in $manifest.watchItems) {
    $null = $lines.Add("- $watchItem")
}

$parentDir = Split-Path -Parent $outputFullPath
if (-not (Test-Path $parentDir)) {
    New-Item -ItemType Directory -Path $parentDir | Out-Null
}

Set-Utf8NoBomContent -Path $outputFullPath -Value $lines
Write-Output "Generated $outputFullPath"
