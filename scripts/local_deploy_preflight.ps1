param(
    [string]$BaseRef = "origin/main",
    [switch]$RequireCodexBranch,
    [switch]$RequireUpstreamSync,
    [switch]$CheckRemoteDeployReference
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Invoke-PreflightStep {
    param(
        [string]$Name,
        [scriptblock]$Script
    )

    Write-Output "==> $Name"
    & $Script
    if ($LASTEXITCODE -ne 0) {
        throw "Preflight step failed: $Name"
    }
}

$worktreeArgs = @("-File", (Join-Path $PSScriptRoot "check_worktree_clean.ps1"))
if ($RequireCodexBranch) {
    $worktreeArgs += "-RequireCodexBranch"
}
if ($RequireUpstreamSync) {
    $worktreeArgs += "-RequireUpstreamSync"
}

Invoke-PreflightStep -Name "Clean local worktree" -Script {
    powershell -ExecutionPolicy Bypass @worktreeArgs
}

Invoke-PreflightStep -Name "Deploy guardrails" -Script {
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_deploy_guardrails.ps1")
}

Invoke-PreflightStep -Name "Platform v2 migration guardrails" -Script {
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_platform_v2_migration_guardrails.ps1") -BaseRef $BaseRef
}

Invoke-PreflightStep -Name "Production manifest/workflow sync" -Script {
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_deploy_manifest_sync.ps1")
}

Invoke-PreflightStep -Name "Staging manifest/workflow sync" -Script {
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_staging_manifest_sync.ps1")
}

if ($CheckRemoteDeployReference) {
    Invoke-PreflightStep -Name "Remote deploy reference sync" -Script {
        powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_remote_deploy_reference.ps1")
    }
}

Write-Output "Local deploy preflight passed."
$global:LASTEXITCODE = 0
exit 0
