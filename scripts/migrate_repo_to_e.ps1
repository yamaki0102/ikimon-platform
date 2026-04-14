param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,

    [string]$DestinationRoot = 'E:\Projects'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $SourcePath)) {
    throw "SourcePath not found: $SourcePath"
}

if (-not (Test-Path -LiteralPath $DestinationRoot)) {
    New-Item -ItemType Directory -Path $DestinationRoot | Out-Null
}

$sourceItem = Get-Item -LiteralPath $SourcePath
$destinationPath = Join-Path $DestinationRoot $sourceItem.Name

Write-Host "Source      : $SourcePath"
Write-Host "Destination : $destinationPath"

if (-not (Test-Path -LiteralPath $destinationPath)) {
    New-Item -ItemType Directory -Path $destinationPath | Out-Null
}

$gitDir = Join-Path $SourcePath '.git'
if (Test-Path -LiteralPath $gitDir) {
    Write-Host ''
    Write-Host 'git status:'
    & git -C $SourcePath status --short
}

Write-Host ''
Write-Host 'Running robocopy...'

$robocopyArgs = @(
    $SourcePath
    $destinationPath
    '/E'
    '/COPY:DAT'
    '/DCOPY:DAT'
    '/R:2'
    '/W:1'
    '/XJ'
    '/MT:16'
)

& robocopy @robocopyArgs
$exitCode = $LASTEXITCODE

if ($exitCode -ge 8) {
    throw "robocopy failed with exit code $exitCode"
}

Write-Host ''
Write-Host "robocopy exit code: $exitCode"

if (Test-Path -LiteralPath (Join-Path $destinationPath '.git')) {
    Write-Host ''
    Write-Host 'destination git status:'
    & git -C $destinationPath status --short
}

Write-Host ''
Write-Host 'Done.'
