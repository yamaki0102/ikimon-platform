param(
    [ValidateSet("local", "staging", "production-smoke", "all")]
    [string]$Mode = "local",
    [string]$Branch = "main",
    [switch]$SkipFullV2Tests,
    [switch]$SkipBackup,
    [switch]$IncludeStagingSessionSmoke,
    [string]$SshHost = "root@162.43.44.131",
    [string]$SshKey = (Join-Path $env:USERPROFILE ".ssh\ikimon_vps.pem")
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$startedAt = Get-Date

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Script
    )

    $stepStart = Get-Date
    Write-Host "== $Name =="
    & $Script
    $elapsed = [math]::Round(((Get-Date) - $stepStart).TotalSeconds, 1)
    Write-Host "OK $Name (${elapsed}s)"
}

function Start-CheckedJob {
    param(
        [string]$Name,
        [scriptblock]$Script
    )

    Start-Job -Name $Name -ScriptBlock {
        param($RepoRoot, $InnerScript)
        Set-Location $RepoRoot
        & $InnerScript
    } -ArgumentList $repoRoot, $Script
}

function Wait-CheckedJobs {
    param([object[]]$Jobs)

    foreach ($job in $Jobs) {
        Write-Host "== wait $($job.Name) =="
        Wait-Job $job | Out-Null
        Receive-Job $job
        if ($job.State -ne "Completed") {
            throw "$($job.Name) failed: $($job.State)"
        }
        Remove-Job $job
        Write-Host "OK $($job.Name)"
    }
}

function Invoke-External {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory = $repoRoot
    )

    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$FilePath $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

function Invoke-LocalGate {
    Invoke-Step "deploy guardrails" {
        Invoke-External "pwsh" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\scripts\check_deploy_guardrails.ps1")
    }
    Invoke-Step "deploy manifest sync" {
        Invoke-External "pwsh" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\scripts\check_deploy_manifest_sync.ps1")
    }
    Invoke-Step "catch-up sync" {
        Invoke-External "pwsh" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\scripts\check_catchup_sync.ps1")
    }

    $jobs = @()
    $jobs += Start-CheckedJob "php lint" {
        & php tools\lint.php
        if ($LASTEXITCODE -ne 0) { throw "php lint failed" }
    }
    $jobs += Start-CheckedJob "platform_v2 checks" {
        Set-Location platform_v2
        & npm run typecheck
        if ($LASTEXITCODE -ne 0) { throw "npm run typecheck failed" }
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
        if (-not $using:SkipFullV2Tests) {
            & npx tsx --test "src/**/*.test.ts"
            if ($LASTEXITCODE -ne 0) { throw "v2 tests failed" }
        }
    }

    Wait-CheckedJobs $jobs
}

function Invoke-StagingDeploy {
    Invoke-Step "trigger staging deploy" {
        Invoke-External "gh" @("workflow", "run", "deploy-staging.yml", "-f", "branch=$Branch", "-f", "allow_non_fast_forward=true")
    }
    Start-Sleep -Seconds 4
    $runsJson = & gh run list --workflow deploy-staging.yml --limit 1 --json databaseId,status,conclusion,headSha,headBranch,createdAt
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to read staging workflow run"
    }
    $run = ($runsJson | ConvertFrom-Json)[0]
    if (-not $run.databaseId) {
        throw "Could not find staging workflow run"
    }
    Invoke-Step "watch staging deploy $($run.databaseId)" {
        Invoke-External "gh" @("run", "watch", [string]$run.databaseId, "--exit-status")
    }
}

function Invoke-ProductionBackupAndSmoke {
    if (-not $SkipBackup) {
        Invoke-Step "production backup" {
            Invoke-External "pwsh" @(
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                ".\scripts\backup_production_v2.ps1",
                "-SshHost",
                $SshHost,
                "-SshKey",
                $SshKey
            )
        }
    }

    Invoke-Step "production release smoke" {
        $args = @(
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            ".\scripts\smoke_v2_release.ps1",
            "-SshHost",
            $SshHost,
            "-SshKey",
            $SshKey
        )
        if ($IncludeStagingSessionSmoke) {
            $args += "-IncludeStagingSessionSmoke"
        }
        Invoke-External "pwsh" $args
    }
}

switch ($Mode) {
    "local" {
        Invoke-LocalGate
    }
    "staging" {
        Invoke-LocalGate
        Invoke-StagingDeploy
    }
    "production-smoke" {
        Invoke-ProductionBackupAndSmoke
    }
    "all" {
        Invoke-LocalGate
        Invoke-StagingDeploy
        Invoke-ProductionBackupAndSmoke
    }
}

$total = [math]::Round(((Get-Date) - $startedAt).TotalSeconds, 1)
Write-Host "Fast GO completed in ${total}s (mode=$Mode)"
