[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$TaskName = "IKIMON Production Verification",
    [string]$StateDirectory = (Join-Path $env:ProgramData "IKIMON\production-verification"),
    [string]$EnvironmentFile = (Join-Path $env:ProgramData "IKIMON\production-verification.env"),
    [string]$BashPath = "",
    [string]$NodePath = "",
    [switch]$NoStart,
    [switch]$Uninstall,
    [switch]$PurgeState,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Find-Executable {
    param([string]$Requested, [string[]]$Candidates, [string]$CommandName)
    if ($Requested) {
        if (-not (Test-Path -LiteralPath $Requested -PathType Leaf)) { throw "Executable not found: $Requested" }
        return (Resolve-Path -LiteralPath $Requested).Path
    }
    foreach ($candidate in $Candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    throw "Required executable not found: $CommandName"
}

function Quote-TaskArgument {
    param([string]$Value)
    return '"' + $Value.Replace('"', '\"') + '"'
}

function Set-PrivateAcl {
    param([string]$Path, [switch]$Directory)
    $systemGrant = if ($Directory) { "*S-1-5-18:(OI)(CI)F" } else { "*S-1-5-18:F" }
    $adminGrant = if ($Directory) { "*S-1-5-32-544:(OI)(CI)F" } else { "*S-1-5-32-544:F" }
    & icacls.exe $Path /inheritance:r /grant:r $systemGrant $adminGrant | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to secure ACL: $Path" }
}

function Invoke-PowerShellChild {
    param([string]$PowerShellPath, [string]$ScriptPath, [string[]]$Arguments)
    & $PowerShellPath -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $ScriptPath @Arguments
    return $LASTEXITCODE
}

if ($PurgeState -and -not $Uninstall) { throw "-PurgeState requires -Uninstall" }
if (-not $DryRun -and -not (Test-IsAdministrator)) {
    throw "Run PowerShell as Administrator or use -DryRun."
}

Import-Module ScheduledTasks -ErrorAction Stop

if ($Uninstall) {
    if ($PSCmdlet.ShouldProcess($TaskName, "Unregister scheduled task")) {
        if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        }
        if ($PurgeState) {
            Remove-Item -LiteralPath $StateDirectory -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Item -LiteralPath $EnvironmentFile -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Output "Windows production verification task uninstalled."
    return
}

$repo = (Resolve-Path -LiteralPath $RepoRoot).Path
$runner = Join-Path $repo "scripts\Invoke-ProductionVerificationWatch.ps1"
$doctor = Join-Path $repo "scripts\Test-ProductionVerificationWindows.ps1"
$environmentExample = Join-Path $repo "ops\monitoring\windows\production-verification.env.example"
foreach ($required in @($runner, $doctor, $environmentExample, (Join-Path $repo "scripts\run_production_verification_watch.sh"))) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required file not found: $required" }
}

$programFiles = [Environment]::GetFolderPath("ProgramFiles")
$localAppData = [Environment]::GetFolderPath("LocalApplicationData")
$bash = Find-Executable -Requested $BashPath -CommandName "bash.exe" -Candidates @(
    (Join-Path $programFiles "Git\bin\bash.exe"),
    (Join-Path $programFiles "Git\usr\bin\bash.exe"),
    (Join-Path $localAppData "Programs\Git\bin\bash.exe")
)
$node = Find-Executable -Requested $NodePath -CommandName "node.exe" -Candidates @((Join-Path $programFiles "nodejs\node.exe"))
$nodeMajor = [int](& $node -p "Number(process.versions.node.split('.')[0])")
if ($nodeMajor -lt 22) { throw "Node.js 22+ is required; found major $nodeMajor" }
$powerShellPath = (Get-Command powershell.exe -ErrorAction Stop).Source

if ($DryRun) {
    Write-Output "DRY-RUN repo=$repo"
    Write-Output "DRY-RUN task=$TaskName"
    Write-Output "DRY-RUN bash=$bash"
    Write-Output "DRY-RUN node=$node"
    Write-Output "DRY-RUN powershell=$powerShellPath"
    Write-Output "DRY-RUN state=$StateDirectory"
    Write-Output "DRY-RUN env=$EnvironmentFile"
    return
}

if ($PSCmdlet.ShouldProcess($StateDirectory, "Create private state directory")) {
    New-Item -ItemType Directory -Path $StateDirectory -Force | Out-Null
    Set-PrivateAcl -Path $StateDirectory -Directory
    New-Item -ItemType Directory -Path (Split-Path -Parent $EnvironmentFile) -Force | Out-Null
    if (-not (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf)) {
        Copy-Item -LiteralPath $environmentExample -Destination $EnvironmentFile
        Write-Output "Created $EnvironmentFile with GitHub status publishing disabled."
    } else {
        Write-Output "Preserving existing environment file: $EnvironmentFile"
    }
    Set-PrivateAcl -Path $EnvironmentFile
}

# Refuse to register a recurring task until one isolated verification succeeds.
$runnerArgs = @(
    "-RepoRoot", $repo,
    "-EnvironmentFile", $EnvironmentFile,
    "-StateDirectory", $StateDirectory,
    "-BashPath", $bash,
    "-NodePath", $node
)
$initialExit = Invoke-PowerShellChild -PowerShellPath $powerShellPath -ScriptPath $runner -Arguments $runnerArgs
if ($initialExit -ne 0) { throw "Initial production verification failed with exit code $initialExit; scheduled task was not installed." }

$arguments = @(
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-File", (Quote-TaskArgument $runner),
    "-RepoRoot", (Quote-TaskArgument $repo),
    "-EnvironmentFile", (Quote-TaskArgument $EnvironmentFile),
    "-StateDirectory", (Quote-TaskArgument $StateDirectory),
    "-BashPath", (Quote-TaskArgument $bash),
    "-NodePath", (Quote-TaskArgument $node)
) -join " "

$action = New-ScheduledTaskAction -Execute $powerShellPath -Argument $arguments -WorkingDirectory $repo
$start = (Get-Date).AddMinutes(1)
$trigger = New-ScheduledTaskTrigger -Once -At $start -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 2)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Read-only IKIMON production verification every 15 minutes"

if ($PSCmdlet.ShouldProcess($TaskName, "Register scheduled task")) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
    Register-ScheduledTask -TaskName $TaskName -InputObject $task | Out-Null
    if (-not $NoStart) { Start-ScheduledTask -TaskName $TaskName }
}

$doctorArgs = @(
    "-RepoRoot", $repo,
    "-TaskName", $TaskName,
    "-StateDirectory", $StateDirectory,
    "-EnvironmentFile", $EnvironmentFile,
    "-BashPath", $bash,
    "-NodePath", $node,
    "-MaxAgeMinutes", "30"
)
$doctorExit = Invoke-PowerShellChild -PowerShellPath $powerShellPath -ScriptPath $doctor -Arguments $doctorArgs
if ($doctorExit -ne 0) { throw "Windows production verification doctor failed with exit code $doctorExit." }
Write-Output "Windows production verification scheduled task installation completed."
