param(
    [string]$OverviewPath = "docs/KNOWLEDGE_OS_OVERVIEW.md"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$overviewFullPath = Join-Path $repoRoot $OverviewPath

if (-not (Test-Path -LiteralPath $overviewFullPath)) {
    Write-Error "Overview file not found: $OverviewPath"
    exit 1
}

$requiredPaths = @(
    "docs/IKIMON_KNOWLEDGE_MAP_2026-04-12.md",
    "docs/IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md",
    "docs/KNOWLEDGE_OS_BRIDGE_2026-04-14.md",
    "docs/STAGING_RUNBOOK.md",
    "docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md",
    "docs/architecture/ikimon_v2_final_cutover_runbook_2026-04-15.md",
    "platform_v2/src/routes/marketing.ts",
    "platform_v2/src/routes/write.ts",
    "platform_v2/src/routes/read.ts",
    "platform_v2/src/routes/health.ts",
    "platform_v2/src/routes/ops.ts",
    "platform_v2/src/routes/uiKpi.ts",
    "platform_v2/src/services/authSession.ts",
    "platform_v2/src/services/specialistReview.ts",
    "platform_v2/src/services/readiness.ts",
    "platform_v2/src/services/writeGuards.ts"
)

$watchedPaths = @(
    "docs/IKIMON_KNOWLEDGE_MAP_2026-04-12.md",
    "docs/IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md",
    "docs/KNOWLEDGE_OS_BRIDGE_2026-04-14.md",
    "docs/STAGING_RUNBOOK.md",
    "docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md",
    "docs/architecture/ikimon_v2_final_cutover_runbook_2026-04-15.md",
    "platform_v2/src/routes/marketing.ts",
    "platform_v2/src/routes/write.ts",
    "platform_v2/src/routes/read.ts",
    "platform_v2/src/routes/ops.ts",
    "platform_v2/src/services/authSession.ts",
    "platform_v2/src/services/readiness.ts",
    "platform_v2/src/services/writeGuards.ts"
)

$overviewContent = Get-Content -Raw -Path $overviewFullPath
$overviewLastWrite = (Get-Item -LiteralPath $overviewFullPath).LastWriteTimeUtc
$hasErrors = $false

$requiredMarkers = @(
    "IKIMON_KNOWLEDGE_MAP_2026-04-12.md",
    "IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md",
    "KNOWLEDGE_OS_BRIDGE_2026-04-14.md",
    "check_knowledge_os_overview_sync.ps1",
    "V2_PRIVILEGED_WRITE_API_KEY",
    "/ops/readiness"
)

foreach ($relativePath in $requiredPaths) {
    $fullPath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath)) {
        Write-Error "Referenced path is missing: $relativePath"
        $hasErrors = $true
    }
}

foreach ($marker in $requiredMarkers) {
    if ($overviewContent -notmatch [regex]::Escape($marker)) {
        Write-Error "Overview is missing required marker: $marker"
        $hasErrors = $true
    }
}

$stalePaths = @()
foreach ($relativePath in $watchedPaths) {
    $fullPath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath)) {
        continue
    }

    $watchedLastWrite = (Get-Item -LiteralPath $fullPath).LastWriteTimeUtc
    if ($watchedLastWrite -gt $overviewLastWrite) {
        $stalePaths += [PSCustomObject]@{
            Path = $relativePath
            UpdatedAtUtc = $watchedLastWrite.ToString("u")
        }
    }
}

if ($stalePaths.Count -gt 0) {
    Write-Error "KNOWLEDGE_OS_OVERVIEW.md is older than watched sources. Review and refresh the overview."
    $stalePaths |
        Sort-Object Path |
        ForEach-Object { Write-Output ("STALE: {0} (updated {1})" -f $_.Path, $_.UpdatedAtUtc) }
    $hasErrors = $true
}

if ($hasErrors) {
    exit 1
}

Write-Output "Knowledge OS overview is in sync."
