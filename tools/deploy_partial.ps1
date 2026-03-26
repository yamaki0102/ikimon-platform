param(
    [Parameter(Mandatory = $true)]
    [string[]]$Files,
    [string]$RemoteAlias = 'production',
    [string]$RemoteBase = '~/public_html/ikimon.life/',
    [switch]$NoDependencies,
    [switch]$SkipRenderGate,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$forbiddenPatterns = @(
    '^upload_package/config/secret\.php$',
    '^upload_package/.*\.(sqlite|sqlite3|db)$',
    '(^|/)\.env$',
    '(^|/)credentials\.json$',
    '^upload_package/vendor/',
    '^tests/'
)

$targetFiles = @()
if ($NoDependencies) {
    $targetFiles = $Files
} else {
    $json = & php "$repoRoot/tools/resolve_deploy_dependencies.php" --json @Files
    $targetFiles = $json | ConvertFrom-Json
}

if (-not $targetFiles -or $targetFiles.Count -eq 0) {
    throw 'No deploy targets were resolved.'
}

$forbiddenTargets = @()
foreach ($target in $targetFiles) {
    foreach ($pattern in $forbiddenPatterns) {
        if ($target -match $pattern) {
            $forbiddenTargets += $target
            break
        }
    }
}

if ($forbiddenTargets.Count -gt 0) {
    throw ('Forbidden deploy targets detected: ' + ($forbiddenTargets | Sort-Object -Unique) -join ', ')
}

$criticalPages = @(
    'upload_package/public_html/index.php',
    'upload_package/public_html/about.php',
    'upload_package/public_html/for-business/index.php'
)

if (-not $SkipRenderGate) {
    $needsRenderGate = $false
    foreach ($criticalPage in $criticalPages) {
        if ($targetFiles -contains $criticalPage) {
            $needsRenderGate = $true
            break
        }
    }

    if ($needsRenderGate) {
        & php "$repoRoot/tools/render_pages.php"
        if ($LASTEXITCODE -ne 0) {
            throw 'CLI render gate failed. Deploy aborted.'
        }
    }
}

$remoteDirs = $targetFiles |
    Where-Object { $_ -like 'upload_package/*' } |
    ForEach-Object {
        Split-Path (($_ -replace '^upload_package/', '') -replace '/', '\') -Parent
    } |
    Where-Object { $_ -and $_ -ne '.' } |
    ForEach-Object { ($_ -replace '\\', '/') } |
    Sort-Object -Unique

Write-Host ''
Write-Host '=== Partial Deploy Targets ==='
$targetFiles | Sort-Object | ForEach-Object { Write-Host $_ }
Write-Host ''

if ($DryRun) {
    Write-Host 'Dry run only. No files uploaded.'
    exit 0
}

foreach ($dir in $remoteDirs) {
    & ssh $RemoteAlias "mkdir -p $RemoteBase/$dir"
}

foreach ($file in ($targetFiles | Sort-Object)) {
    if ($file -notlike 'upload_package/*') {
        Write-Warning "Skipping unsupported target outside upload_package/: $file"
        continue
    }

    $localPath = Join-Path $repoRoot $file
    if (-not (Test-Path $localPath)) {
        throw "Local file not found: $localPath"
    }

    $remotePath = $file -replace '^upload_package/', ''
    & scp $localPath "$RemoteAlias`:$RemoteBase/$remotePath"
    if ($LASTEXITCODE -ne 0) {
        throw "Upload failed: $file"
    }
}

Write-Host 'Partial deploy completed.'
