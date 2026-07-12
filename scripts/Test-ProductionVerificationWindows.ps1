[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$TaskName = "IKIMON Production Verification",
    [string]$StateDirectory = (Join-Path $env:ProgramData "IKIMON\production-verification"),
    [string]$EnvironmentFile = (Join-Path $env:ProgramData "IKIMON\production-verification.env"),
    [string]$BashPath = "",
    [string]$NodePath = "",
    [int]$MaxAgeMinutes = 30,
    [switch]$AllowMissingTask
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$errors = 0
$warnings = 0

function Pass([string]$Message) { Write-Host "PASS  $Message" }
function Warn([string]$Message) { Write-Warning $Message; $script:warnings++ }
function Fail([string]$Message) { Write-Error $Message -ErrorAction Continue; $script:errors++ }

function Find-Executable {
    param([string]$Requested, [string[]]$Candidates, [string]$CommandName)
    if ($Requested) {
        if (Test-Path -LiteralPath $Requested -PathType Leaf) { return (Resolve-Path -LiteralPath $Requested).Path }
        return $null
    }
    foreach ($candidate in $Candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return (Resolve-Path -LiteralPath $candidate).Path }
    }
    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    return $null
}

function Get-EnvironmentSettings([string]$Path) {
    $result = @{}
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $result }
    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $separator = $trimmed.IndexOf("=")
        if ($separator -lt 1) { continue }
        $result[$trimmed.Substring(0, $separator).Trim()] = $trimmed.Substring($separator + 1)
    }
    return $result
}

function Test-PrivateAcl([string]$Path) {
    try {
        $acl = Get-Acl -LiteralPath $Path
        $forbiddenSids = @("S-1-1-0", "S-1-5-32-545", "S-1-5-11") # Everyone, Users, Authenticated Users
        foreach ($entry in $acl.Access) {
            $sid = $entry.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
            $writeRights = [Security.AccessControl.FileSystemRights]::WriteData -bor
                [Security.AccessControl.FileSystemRights]::AppendData -bor
                [Security.AccessControl.FileSystemRights]::Modify -bor
                [Security.AccessControl.FileSystemRights]::FullControl
            if ($forbiddenSids -contains $sid -and (($entry.FileSystemRights -band $writeRights) -ne 0) -and $entry.AccessControlType -eq "Allow") {
                return $false
            }
        }
        return $true
    } catch {
        return $false
    }
}

if ($MaxAgeMinutes -lt 1) { throw "MaxAgeMinutes must be positive" }
$repo = $null
try { $repo = (Resolve-Path -LiteralPath $RepoRoot).Path } catch { Fail "Repository root missing: $RepoRoot" }
if ($repo -and (Test-Path -LiteralPath (Join-Path $repo "scripts\Invoke-ProductionVerificationWatch.ps1"))) {
    Pass "Windows verification runner exists"
} else {
    Fail "Windows verification runner missing"
}

$programFiles = [Environment]::GetFolderPath("ProgramFiles")
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$bash = Find-Executable -Requested $BashPath -CommandName "bash.exe" -Candidates @(
    (Join-Path $programFiles "Git\bin\bash.exe"),
    (Join-Path $programFiles "Git\usr\bin\bash.exe"),
    (Join-Path $localAppData "Programs\Git\bin\bash.exe")
)
$node = Find-Executable -Requested $NodePath -CommandName "node.exe" -Candidates @((Join-Path $programFiles "nodejs\node.exe"))
if ($bash) { Pass "Git Bash found: $bash" } else { Fail "Git Bash not found" }
if ($node) {
    $nodeMajor = [int](& $node -p "Number(process.versions.node.split('.')[0])")
    if ($nodeMajor -ge 22) { Pass "Node.js $nodeMajor satisfies baseline" } else { Fail "Node.js 22+ required; found $nodeMajor" }
} else { Fail "node.exe not found" }

if (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf) {
    Pass "Environment file exists: $EnvironmentFile"
    if (Test-PrivateAcl $EnvironmentFile) { Pass "Environment file ACL does not grant write access to broad principals" } else { Fail "Environment file ACL is too broad or unreadable" }
    $settings = Get-EnvironmentSettings $EnvironmentFile
    $publish = [string]$settings["PUBLISH_GITHUB_STATUS"]
    $hasToken = -not [string]::IsNullOrWhiteSpace([string]$settings["GITHUB_TOKEN"]) -or -not [string]::IsNullOrWhiteSpace([string]$settings["GH_TOKEN"])
    if ($publish -eq "true") {
        if ($hasToken) { Pass "GitHub status publishing has a token" } else { Fail "PUBLISH_GITHUB_STATUS=true but token is missing" }
    } else { Warn "GitHub status publishing is disabled; local monitoring remains active" }
} else { Fail "Environment file missing: $EnvironmentFile" }

if (Test-Path -LiteralPath $StateDirectory -PathType Container) {
    Pass "State directory exists: $StateDirectory"
    if (Test-PrivateAcl $StateDirectory) { Pass "State directory ACL is private" } else { Fail "State directory ACL is too broad or unreadable" }
} else { Fail "State directory missing: $StateDirectory" }

Import-Module ScheduledTasks -ErrorAction SilentlyContinue
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Pass "Scheduled task installed: $TaskName"
    if ($task.State -ne "Disabled") { Pass "Scheduled task enabled; state=$($task.State)" } else { Fail "Scheduled task is disabled" }
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    if ($info.LastTaskResult -eq 0) { Pass "Last scheduled task result is success" }
    elseif ($info.LastRunTime -eq [datetime]::MinValue) { Warn "Scheduled task has not run yet" }
    else { Fail "Last scheduled task result: $($info.LastTaskResult)" }
    $actionText = ($task.Actions | ForEach-Object { "$($_.Execute) $($_.Arguments)" }) -join "`n"
    if ($repo -and $actionText -like "*$repo*" -and $actionText -like "*Invoke-ProductionVerificationWatch.ps1*") {
        Pass "Scheduled task points to the current repo and runner"
    } else { Fail "Scheduled task action does not point to the current runner" }
    $intervals = @($task.Triggers | ForEach-Object { $_.Repetition.Interval } | Where-Object { $_ })
    if ($intervals -contains "PT15M") { Pass "Scheduled task interval is 15 minutes" } else { Fail "Scheduled task interval is not 15 minutes" }
} elseif ($AllowMissingTask) { Warn "Scheduled task is not installed" } else { Fail "Scheduled task missing: $TaskName" }

try {
    $runtime = Invoke-RestMethod -Uri "https://ikimon.life/api/v1/runtime/version?windows_doctor=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" -Headers @{ "Cache-Control" = "no-store" } -TimeoutSec 30
    $runtimeSha = [string]$runtime.gitSha
    if ($runtimeSha -match '^[0-9a-fA-F]{40}$') { Pass "Production runtime returned exact SHA $($runtimeSha.Substring(0, 12))" } else { Fail "Production runtime gitSha is invalid" }
} catch {
    $runtimeSha = ""
    Fail "Production runtime endpoint failed: $($_.Exception.Message)"
}

$reportPath = Join-Path $StateDirectory "production-verification-latest.json"
if (Test-Path -LiteralPath $reportPath -PathType Leaf) {
    try {
        $report = Get-Content -Raw -LiteralPath $reportPath -Encoding UTF8 | ConvertFrom-Json
        if ($report.schemaVersion -ne "ikimon_production_verification/v1") { throw "unsupported schema" }
        if ($report.status -ne "success") { throw "status=$($report.status)" }
        if (-not $report.noPersonalData -or $report.productionMutation) { throw "safety contract" }
        if (-not $report.shaMatches) { throw "shaMatches=false" }
        if ($runtimeSha -and $report.expectedGitSha -ne $runtimeSha) { throw "runtime SHA mismatch" }
        $ageMinutes = ([DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse([string]$report.finishedAt)).TotalMinutes
        if ($ageMinutes -gt $MaxAgeMinutes) { throw "stale report: $([math]::Round($ageMinutes, 1)) minutes" }
        Pass "Latest verification report is successful, safe, SHA-bound, and fresh"
    } catch { Fail "Latest verification report invalid: $($_.Exception.Message)" }
} else { Fail "Latest verification report missing: $reportPath" }

$archivePointer = Join-Path $StateDirectory "history\latest.json"
if (Test-Path -LiteralPath $archivePointer -PathType Leaf) { Pass "Historical evidence archive pointer exists" } else { Warn "Historical evidence archive pointer missing" }

Write-Host ""
Write-Host "Windows doctor summary: errors=$errors warnings=$warnings"
if ($errors -gt 0) { exit 1 }
exit 0
