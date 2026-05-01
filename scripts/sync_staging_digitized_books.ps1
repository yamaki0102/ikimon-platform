param(
    [Parameter(Mandatory = $true)]
    [string]$Source,
    [string]$HostAlias = "ikimon-vps",
    [string]$StagingRoot = "/var/www/ikimon.life-staging",
    [switch]$SkipUpload
)

$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Resolve-BookRoot([string]$InputPath) {
    $resolved = (Resolve-Path -LiteralPath $InputPath).Path
    $dataCandidate = Join-Path $resolved "data"
    if (Test-Path -LiteralPath $dataCandidate -PathType Container) {
        return (Resolve-Path -LiteralPath $dataCandidate).Path
    }
    return $resolved
}

function New-StableBookId([string]$Title) {
    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Title.Trim().ToLowerInvariant())
        $hash = $sha1.ComputeHash($bytes)
        $hex = -join ($hash | ForEach-Object { $_.ToString("x2") })
        return "book_" + $hex.Substring(0, 12)
    } finally {
        $sha1.Dispose()
    }
}

function Get-PageNumber([string]$FileName, [int]$Fallback) {
    $match = [regex]::Match($FileName, 'Page\s*0*([0-9]+)', 'IgnoreCase')
    if ($match.Success) {
        return [int]$match.Groups[1].Value
    }
    return $Fallback
}

function Get-BookManifest([System.IO.DirectoryInfo]$DirectoryInfo) {
    $files = Get-ChildItem -LiteralPath $DirectoryInfo.FullName -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|webp)$' } |
        Sort-Object Name

    $pages = @()
    $index = 0
    foreach ($file in $files) {
        $index++
        $pages += [ordered]@{
            pageIndex    = $index
            pageNumber   = Get-PageNumber -FileName $file.Name -Fallback $index
            filename     = $file.Name
            relativePath = (($DirectoryInfo.Name + "/" + $file.Name) -replace '\\', '/')
        }
    }

    return @{
        pages = $pages
        pageCount = $pages.Count
    }
}

function Write-JsonNoBom([string]$Path, $Value) {
    $json = $Value | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText($Path, $json, $Utf8NoBom)
}

$bookRoot = Resolve-BookRoot -InputPath $Source
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tmpRoot = Join-Path $repoRoot "_tmp_digitized_books"
$libraryRoot = Join-Path $tmpRoot "library"
$pagesRoot = Join-Path $libraryRoot "digitized_pages"

if (Test-Path -LiteralPath $tmpRoot) {
    Remove-Item -LiteralPath $tmpRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $pagesRoot -Force | Out-Null

$catalog = @()
$directories = Get-ChildItem -LiteralPath $bookRoot -Directory | Sort-Object Name

foreach ($directory in $directories) {
    $manifest = Get-BookManifest -DirectoryInfo $directory
    if ($manifest.pageCount -le 0) {
        continue
    }

    $bookId = New-StableBookId -Title $directory.Name
    $updatedAt = [DateTimeOffset]::UtcNow.ToString("o")
    $usagePolicy = [ordered]@{
        visibility      = "internal_only"
        publicOutput    = "citation_and_summary_only"
        rawScanHandling = "do_not_publish"
        note            = "Raw scans are internal-only. Public output must stay at citation, summary, and factual metadata."
    }

    $catalog += [ordered]@{
        id          = $bookId
        title       = $directory.Name
        folderName  = $directory.Name
        pageCount   = $manifest.pageCount
        coverImage  = if ($manifest.pageCount -gt 0) { $manifest.pages[0].relativePath } else { $null }
        visibility  = "internal_only"
        publicUsage = "citation_and_summary_only"
        usagePolicy = $usagePolicy
        updatedAt   = $updatedAt
    }

    $manifestPayload = [ordered]@{
        bookId    = $bookId
        title     = $directory.Name
        pageCount = $manifest.pageCount
        pages     = $manifest.pages
    }

    $manifestPath = Join-Path $pagesRoot ($bookId + ".json")
    Write-JsonNoBom -Path $manifestPath -Value $manifestPayload
}

$catalogPath = Join-Path $libraryRoot "digitized_books_catalog.json"
Write-JsonNoBom -Path $catalogPath -Value $catalog

$summary = [ordered]@{
    sourceRoot = $bookRoot
    books = $catalog.Count
    pages = @($catalog | ForEach-Object { [int]($_["pageCount"]) } | Measure-Object -Sum).Sum
    output = $libraryRoot
}
$summary | ConvertTo-Json -Depth 4

if (-not $SkipUpload) {
    & ssh $HostAlias "mkdir -p '$StagingRoot/repo/upload_package/data/library/digitized_pages'"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create staging digitized_books directory."
    }

    & scp -q $catalogPath "${HostAlias}:$StagingRoot/repo/upload_package/data/library/digitized_books_catalog.json"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to upload digitized_books_catalog.json"
    }

    & scp -q (Join-Path $pagesRoot "*.json") "${HostAlias}:$StagingRoot/repo/upload_package/data/library/digitized_pages/"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to upload digitized page manifests"
    }
}
