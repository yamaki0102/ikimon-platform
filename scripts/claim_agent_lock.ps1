param(
    [ValidateSet('codex', 'claude')]
    [string]$Agent,

    [string]$Task = '',

    [switch]$Release
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $repoRoot '.agent\runtime'
$lockPath = Join-Path $runtimeDir 'active-editor.json'

if (-not (Test-Path -LiteralPath $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
}

if ($Release) {
    if (Test-Path -LiteralPath $lockPath) {
        Remove-Item -LiteralPath $lockPath -Force
        Write-Host 'Released active editor lock.'
    } else {
        Write-Host 'No active editor lock.'
    }
    exit 0
}

if (-not $Agent) {
    throw 'Agent is required unless -Release is specified.'
}

$payload = [ordered]@{
    agent = $Agent
    task = $Task
    claimedAt = (Get-Date).ToString('s')
    repo = $repoRoot
}

$json = $payload | ConvertTo-Json
[System.IO.File]::WriteAllText($lockPath, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Active editor: $Agent"
Write-Host "Lock file: $lockPath"
