param(
    [string]$OutputPath = "docs/CATCHUP_SNAPSHOT.md",
    [string]$ManifestPath = "docs/catchup_manifest.json"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputFullPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $repoRoot $OutputPath }
$manifestFullPath = if ([System.IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $repoRoot $ManifestPath }

function Get-RelativePath {
    param([string]$BasePath, [string]$TargetPath)

    $baseUri = [Uri]($BasePath.TrimEnd('\') + '\')
    $targetUri = [Uri]$TargetPath
    return [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', '\')
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

    return Get-ChildItem -Path $Path -File -Filter $Filter -Recurse:$Recurse
}

if (-not (Test-Path $manifestFullPath)) {
    throw "Manifest not found: $manifestFullPath"
}

$manifest = Get-Content -Raw -Path $manifestFullPath | ConvertFrom-Json
$excludedTopLevelDirectories = @($manifest.excludeTopLevelDirectories)

$topLevelDirectories = Get-ChildItem -Path $repoRoot -Directory |
    Where-Object { $_.Name -notin $excludedTopLevelDirectories } |
    Sort-Object Name

$publicPages = Get-FileList -Path (Join-Path $repoRoot "upload_package\public_html") -Filter "*.php"
$apiFiles = Get-FileList -Path (Join-Path $repoRoot "upload_package\public_html\api") -Filter "*.php" -Recurse
$libFiles = Get-FileList -Path (Join-Path $repoRoot "upload_package\libs") -Filter "*.php" -Recurse
$testFiles = Get-FileList -Path (Join-Path $repoRoot "tests") -Filter "*.php" -Recurse
$androidFiles =
    (Get-FileList -Path (Join-Path $repoRoot "mobile\android\ikimon-pocket\app\src\main") -Filter "*.kt" -Recurse) +
    (Get-FileList -Path (Join-Path $repoRoot "mobile\android\ikimon-pocket\app\src\main") -Filter "*.java" -Recurse)

$largestPages = $publicPages | Sort-Object Length -Descending | Select-Object -First 10
$largestLibs = $libFiles | Sort-Object Length -Descending | Select-Object -First 10
$scriptFiles =
    (Get-FileList -Path (Join-Path $repoRoot "scripts") -Recurse) +
    (Get-FileList -Path (Join-Path $repoRoot "upload_package\scripts") -Recurse) +
    (Get-FileList -Path (Join-Path $repoRoot "upload_package\tools") -Recurse)

$lines = New-Object System.Collections.Generic.List[string]
$null = $lines.Add("# Catch-Up Snapshot")
$null = $lines.Add("")
$null = $lines.Add("Manifest: $ManifestPath (v$($manifest.version))")
$null = $lines.Add("")
$null = $lines.Add("## Scale")
$null = $lines.Add("")
$null = $lines.Add("| Area | Count |")
$null = $lines.Add("|---|---:|")
$null = $lines.Add("| Top-level directories | $($topLevelDirectories.Count) |")
$null = $lines.Add("| Public PHP pages | $($publicPages.Count) |")
$null = $lines.Add("| API PHP files | $($apiFiles.Count) |")
$null = $lines.Add("| Library PHP files | $($libFiles.Count) |")
$null = $lines.Add("| Test PHP files | $($testFiles.Count) |")
$null = $lines.Add("| Android source files | $($androidFiles.Count) |")
$null = $lines.Add("| Repo / app scripts & tools | $($scriptFiles.Count) |")
$null = $lines.Add("")
$null = $lines.Add("Skipped support directories: " + ($excludedTopLevelDirectories -join ", "))
$null = $lines.Add("Refresh policy: structure change = $($manifest.refreshPolicy.runAfterStructureChange), review cadence = every $($manifest.refreshPolicy.reviewEveryMonths) months")
$null = $lines.Add("")
foreach ($section in $manifest.sections) {
    $null = $lines.Add("## $($section.title)")
    $null = $lines.Add("")

    switch ($section.mode) {
        "top_level_directories" {
            foreach ($directory in $topLevelDirectories) {
                $fileCount = (Get-ChildItem -Path $directory.FullName -File -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count
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
                    $count = (Get-ChildItem -Path $directory.FullName -File -Filter $section.filter -Recurse | Measure-Object).Count
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

Set-Content -Path $outputFullPath -Value $lines -Encoding UTF8
Write-Output "Generated $outputFullPath"
