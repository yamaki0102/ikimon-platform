param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$EnvironmentFile = (Join-Path $env:ProgramData "IKIMON\production-verification.env"),
    [string]$StateDirectory = (Join-Path $env:ProgramData "IKIMON\production-verification"),
    [string]$BashPath = "",
    [string]$NodePath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Find-Executable {
    param(
        [string]$Requested,
        [string[]]$Candidates,
        [string]$CommandName
    )
    if (-not [string]::IsNullOrWhiteSpace($Requested)) {
        if (-not (Test-Path -LiteralPath $Requested -PathType Leaf)) {
            throw "Executable not found: $Requested"
        }
        return (Resolve-Path -LiteralPath $Requested).Path
    }
    foreach ($candidate in $Candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    throw "Required executable not found: $CommandName"
}

function Convert-ToGitBashPath {
    param([string]$WindowsPath)
    $full = [IO.Path]::GetFullPath($WindowsPath)
    if ($full -match '^([A-Za-z]):\\(.*)$') {
        $drive = $Matches[1].ToLowerInvariant()
        $tail = $Matches[2].Replace('\', '/')
        return "/$drive/$tail"
    }
    if ($full.StartsWith('\\')) {
        return '//' + $full.TrimStart('\').Replace('\', '/')
    }
    return $full.Replace('\', '/')
}

function Import-SafeEnvironmentFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Environment file not found: $Path"
    }
    $allowed = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    @(
        "GITHUB_REPOSITORY",
        "GITHUB_TOKEN",
        "GH_TOKEN",
        "PUBLISH_GITHUB_STATUS",
        "IKIMON_STATUS_TARGET_URL",
        "IKIMON_VERIFICATION_TARGET_URL",
        "SMOKE_TIER",
        "PLAYWRIGHT_INSTALL_WITH_DEPS",
        "IKIMON_VERIFICATION_ARCHIVE_RETENTION_DAYS"
    ) | ForEach-Object { [void]$allowed.Add($_) }

    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $separator = $trimmed.IndexOf("=")
        if ($separator -lt 1) { throw "Malformed environment line in ${Path}: $trimmed" }
        $name = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1)
        if (-not $name -or -not $allowed.Contains($name)) {
            throw "Unsupported environment variable in ${Path}: $name"
        }
        if ($value.Contains([char]0) -or $value.Contains("`r") -or $value.Contains("`n")) {
            throw "Invalid environment value for $name"
        }
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

$repo = (Resolve-Path -LiteralPath $RepoRoot).Path
$watchScript = Join-Path $repo "scripts\run_production_verification_watch.sh"
if (-not (Test-Path -LiteralPath $watchScript -PathType Leaf)) {
    throw "Production verification watch script not found: $watchScript"
}

$programFiles = [Environment]::GetFolderPath("ProgramFiles")
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$bash = Find-Executable -Requested $BashPath -CommandName "bash.exe" -Candidates @(
    (Join-Path $programFiles "Git\bin\bash.exe"),
    (Join-Path $programFiles "Git\usr\bin\bash.exe"),
    (Join-Path $localAppData "Programs\Git\bin\bash.exe")
)
$node = Find-Executable -Requested $NodePath -CommandName "node.exe" -Candidates @(
    (Join-Path $programFiles "nodejs\node.exe")
)
$nodeMajor = [int](& $node -p "Number(process.versions.node.split('.')[0])")
if ($nodeMajor -lt 22) { throw "Node.js 22+ is required; found major $nodeMajor" }

Import-SafeEnvironmentFile -Path $EnvironmentFile
$state = [IO.Path]::GetFullPath($StateDirectory)
New-Item -ItemType Directory -Force -Path $state | Out-Null
$historyDirectory = Join-Path $state "history"
New-Item -ItemType Directory -Force -Path $historyDirectory | Out-Null

$sourceValue = [Environment]::GetEnvironmentVariable("IKIMON_VERIFICATION_SOURCE", "Process")
$runnerValue = [Environment]::GetEnvironmentVariable("IKIMON_VERIFICATION_RUNNER_ID", "Process")
$env:IKIMON_VERIFICATION_SOURCE = if ($sourceValue) { $sourceValue } else { "windows-scheduled-task" }
$env:IKIMON_VERIFICATION_RUNNER_ID = if ($runnerValue) { $runnerValue } else { $env:COMPUTERNAME }
$env:IKIMON_VERIFICATION_REPORT_PATH = Convert-ToGitBashPath (Join-Path $state "production-verification-latest.json")
$env:IKIMON_VERIFICATION_LOG_PATH = Convert-ToGitBashPath (Join-Path $state "production-verification-latest.log")
$env:IKIMON_VERIFICATION_RUNTIME_PATH = Convert-ToGitBashPath (Join-Path $state "production-runtime-version-latest.json")
$env:IKIMON_VERIFICATION_ARCHIVE_DIR = Convert-ToGitBashPath $historyDirectory
if (-not $env:IKIMON_VERIFICATION_ARCHIVE_RETENTION_DAYS) { $env:IKIMON_VERIFICATION_ARCHIVE_RETENTION_DAYS = "14" }
if (-not $env:SMOKE_TIER) { $env:SMOKE_TIER = "targeted" }
if (-not $env:PLAYWRIGHT_INSTALL_WITH_DEPS) { $env:PLAYWRIGHT_INSTALL_WITH_DEPS = "false" }
if (-not $env:PUBLISH_GITHUB_STATUS) { $env:PUBLISH_GITHUB_STATUS = "false" }

$env:PATH = "$(Split-Path -Parent $node);$(Split-Path -Parent $bash);$env:PATH"
$env:CHERE_INVOKING = "1"
$scriptForBash = Convert-ToGitBashPath $watchScript

Push-Location $repo
try {
    & $bash $scriptForBash
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
if ($null -eq $exitCode) { $exitCode = 1 }
exit $exitCode
