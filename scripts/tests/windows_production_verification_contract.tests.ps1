$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$assertions = 0

function Assert-True {
    param([bool]$Condition, [string]$Message)
    $script:assertions++
    if (-not $Condition) { throw $Message }
}

function Read-Text([string]$RelativePath) {
    return Get-Content -Raw -LiteralPath (Join-Path $repoRoot $RelativePath) -Encoding UTF8
}

function Assert-Parses([string]$RelativePath) {
    $tokens = $null
    $errors = $null
    $fullPath = Join-Path $repoRoot $RelativePath
    [void][System.Management.Automation.Language.Parser]::ParseFile($fullPath, [ref]$tokens, [ref]$errors)
    Assert-True (@($errors).Count -eq 0) "$RelativePath must parse: $((@($errors) | ForEach-Object Message) -join '; ')"
}

$runnerPath = "scripts/Invoke-ProductionVerificationWatch.ps1"
$installerPath = "scripts/Install-ProductionVerificationScheduledTask.ps1"
$doctorPath = "scripts/Test-ProductionVerificationWindows.ps1"
foreach ($path in @($runnerPath, $installerPath, $doctorPath)) { Assert-Parses $path }

$runner = Read-Text $runnerPath
$installer = Read-Text $installerPath
$doctor = Read-Text $doctorPath
$environmentExample = Read-Text "ops/monitoring/windows/production-verification.env.example"

foreach ($marker in @(
    "Import-SafeEnvironmentFile",
    "Convert-ToGitBashPath",
    "IKIMON_VERIFICATION_ARCHIVE_DIR",
    "windows-scheduled-task",
    "Node.js 22+"
)) {
    Assert-True ($runner.Contains($marker)) "Windows runner is missing marker: $marker"
}
Assert-True (-not ($runner -match 'Invoke-Expression|iex\s')) "Windows runner must not evaluate environment file content"

foreach ($marker in @(
    'New-ScheduledTaskPrincipal -UserId "SYSTEM"',
    'RepetitionInterval (New-TimeSpan -Minutes 15)',
    'Wait-ScheduledTaskCompletion',
    'Registered SYSTEM task failed',
    'Preserving existing environment file',
    'Invoke-PowerShellChild',
    '*S-1-5-18',
    'Initial production verification failed'
)) {
    Assert-True ($installer.Contains($marker)) "Windows installer is missing marker: $marker"
}
Assert-True (-not ($installer -match '--(?:github|cloudflare)-token')) "Windows installer must not accept token command-line options"
Assert-True ($installer.IndexOf('Initial production verification failed') -lt $installer.IndexOf('Register-ScheduledTask')) "Direct verification must precede task registration"
Assert-True ($installer.IndexOf('Start-ScheduledTask') -lt $installer.LastIndexOf('Wait-ScheduledTaskCompletion')) "Registered SYSTEM execution must be awaited"

foreach ($marker in @(
    "Test-PrivateAcl",
    "Get-ScheduledTaskInfo",
    "PT15M",
    "noPersonalData",
    "productionMutation",
    "expectedGitSha",
    "MaxAgeMinutes"
)) {
    Assert-True ($doctor.Contains($marker)) "Windows doctor is missing marker: $marker"
}

Assert-True ($environmentExample -match '(?m)^PUBLISH_GITHUB_STATUS=false$') "Windows environment example must disable status publishing by default"
Assert-True (-not ($environmentExample -match '(?m)^(?:GITHUB_TOKEN|GH_TOKEN)=\S+')) "Windows environment example must not contain a token value"

Write-Output "Windows production verification contract tests passed: $assertions assertions"
