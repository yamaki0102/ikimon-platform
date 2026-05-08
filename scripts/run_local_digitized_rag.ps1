param(
    [Parameter(Mandatory = $true)]
    [string]$BookPath,

    [int]$StartPage = 1,

    [int]$EndPage = 0,

    [switch]$Resume,

    [ValidateSet(0, 90, 180, 270)]
    [int]$RotateDegrees = 0,

    [string]$OutputSuffix = ''
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$phpScript = Join-Path $repoRoot 'upload_package\scripts\ingestion\pilot_digitized_book_rag.php'

if (-not (Test-Path -LiteralPath $phpScript)) {
    throw "pilot script not found: $phpScript"
}

$resolvedBookPath = (Resolve-Path -LiteralPath $BookPath).Path

if (-not (Test-Path -LiteralPath $resolvedBookPath -PathType Container)) {
    throw "book directory not found: $BookPath"
}

if (-not $env:GEMINI_API_KEY) {
    $userKey = [Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User')
    if ($userKey) {
        $env:GEMINI_API_KEY = $userKey
    }
}

if (-not $env:GEMINI_API_KEY) {
    throw 'GEMINI_API_KEY is not configured in the current process or user environment.'
}

$processingBookPath = $resolvedBookPath
if ($RotateDegrees -ne 0) {
    Add-Type -AssemblyName System.Drawing

    $cacheRoot = Join-Path $repoRoot 'upload_package\data\library\preprocessed_books'
    $bookName = Split-Path -Leaf $resolvedBookPath
    $rotationRoot = Join-Path $cacheRoot ("rot_{0}" -f $RotateDegrees)
    $processingBookPath = Join-Path $rotationRoot $bookName

    New-Item -ItemType Directory -Force -Path $processingBookPath | Out-Null

    $rotateFlipType = switch ($RotateDegrees) {
        90 { [System.Drawing.RotateFlipType]::Rotate90FlipNone }
        180 { [System.Drawing.RotateFlipType]::Rotate180FlipNone }
        270 { [System.Drawing.RotateFlipType]::Rotate270FlipNone }
        default { [System.Drawing.RotateFlipType]::RotateNoneFlipNone }
    }

    Get-ChildItem -LiteralPath $resolvedBookPath -File | ForEach-Object {
        $source = $_
        $targetPath = Join-Path $processingBookPath $source.Name
        $isImage = $source.Extension -match '^\.(jpg|jpeg|png)$'

        if (-not $isImage) {
            Copy-Item -LiteralPath $source.FullName -Destination $targetPath -Force
            return
        }

        $needsRefresh = -not (Test-Path -LiteralPath $targetPath) -or $source.LastWriteTimeUtc -gt (Get-Item -LiteralPath $targetPath).LastWriteTimeUtc
        if (-not $needsRefresh) {
            return
        }

        $image = [System.Drawing.Image]::FromFile($source.FullName)
        try {
            $image.RotateFlip($rotateFlipType)
            $format = switch ($source.Extension.ToLowerInvariant()) {
                '.png' { [System.Drawing.Imaging.ImageFormat]::Png }
                default { [System.Drawing.Imaging.ImageFormat]::Jpeg }
            }
            $image.Save($targetPath, $format)
        } finally {
            $image.Dispose()
        }
    }
}

$arguments = @($phpScript, $processingBookPath, $StartPage)
if ($EndPage -gt 0) {
    $arguments += $EndPage
}
if ($Resume) {
    $arguments += '--resume'
}
if ($OutputSuffix) {
    $arguments += "--output-suffix=$OutputSuffix"
}

Write-Host "Running digitized RAG pilot for: $resolvedBookPath"
$pageLabel = if ($EndPage -gt 0) { "$StartPage-$EndPage" } else { "$StartPage-auto" }
Write-Host "Pages: $pageLabel"
if ($RotateDegrees -ne 0) {
    Write-Host "Rotate: $RotateDegrees degrees"
}
if ($OutputSuffix) {
    Write-Host "Output suffix: $OutputSuffix"
}

& php @arguments
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
