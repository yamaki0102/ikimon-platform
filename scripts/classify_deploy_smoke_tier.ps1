param(
    [string]$RepoRoot = (Resolve-Path ".").Path,
    [string]$BaseRef = "",
    [string]$HeadRef = "HEAD",
    [string[]]$ChangedFiles = @(),
    [string]$GitHubOutput = $env:GITHUB_OUTPUT
)

$ErrorActionPreference = "Stop"

function Normalize-RepoPath {
    param([string]$Path)

    return ($Path -replace "\\", "/").Trim()
}

function Test-IsZeroSha {
    param([string]$Value)

    return $Value -match "^0{40}$"
}

function Test-TargetedSmokeAllowedPath {
    param([string]$Path)

    $normalized = Normalize-RepoPath $Path
    switch -Regex ($normalized) {
        "^docs/" { return $true }
        "^ops/deploy/" { return $true }
        "^\.github/workflows/deploy\.yml$" { return $true }
        "^scripts/classify_deploy_smoke_tier\.ps1$" { return $true }
        "^scripts/run_targeted_candidate_smoke\.mjs$" { return $true }
        "^scripts/(summarize_deploy_timing|summarize_prepare_timing|deploy_status_summary|local_deploy_preflight|check_deploy_guardrails|check_deploy_manifest_sync|check_staging_manifest_sync|check_remote_deploy_reference|check_platform_v2_migration_guardrails|check_legacy_entrypoint_reason)\.ps1$" { return $true }
        "^platform_v2/scripts/ops/" { return $true }
        "^platform_v2/src/legacy/" { return $true }
        "^platform_v2/src/scripts/(bootstrapLegacyImport|syncLegacyDelta|syncLegacyUserAuth|verifyLegacyParity|verifyProductionShadowParity|reportLegacyDrift|materializeLegacyVerifySnapshot|planObservationLedger|readinessReport)\.ts$" { return $true }
        "^platform_v2/src/scripts/import[A-Za-z0-9]+\.ts$" { return $true }
        "^platform_v2/src/scripts/(bootstrapLegacyImport|syncLegacyDelta)\.test\.ts$" { return $true }
        default { return $false }
    }
}

function Test-LegacyLaneFullRequiredPath {
    param([string]$Path)

    $normalized = Normalize-RepoPath $Path
    switch -Regex ($normalized) {
        "^upload_package/" { return $true }
        "\.php$" { return $true }
        "(^|/)\.htaccess$" { return $true }
        "^composer\.(json|lock)$" { return $true }
        "^ops/deploy/(production_deploy_reference\.sh|runtime_persistent_allowlist\.txt|legacy_entrypoint_reasons\.json)$" { return $true }
        default { return $false }
    }
}

function Write-GitHubOutputValue {
    param(
        [string]$Name,
        [string]$Value
    )

    if (-not $GitHubOutput) {
        return
    }

    Add-Content -Path $GitHubOutput -Value "$Name=$Value"
}

if ($ChangedFiles.Count -eq 0) {
    if (-not $BaseRef -or (Test-IsZeroSha $BaseRef)) {
        $classification = [ordered]@{
            smokeTier = "full"
            reason = "missing_base_ref"
            changedCount = 0
            changedFiles = @()
            fullTriggerFiles = @()
            legacyLaneMode = "full"
            legacyLaneReason = "missing_base_ref"
            legacyLaneFullTriggerFiles = @()
        }
    } else {
        $rawChangedFiles = & git -C $RepoRoot diff --name-only $BaseRef $HeadRef
        if ($LASTEXITCODE -ne 0) {
            throw "git diff failed for $BaseRef..$HeadRef"
        }
        $ChangedFiles = @($rawChangedFiles | Where-Object { $_ -and $_.Trim() -ne "" })
    }
}

if (-not $classification) {
    $normalizedFiles = @($ChangedFiles | ForEach-Object { Normalize-RepoPath $_ } | Where-Object { $_ -ne "" } | Sort-Object -Unique)
    if ($normalizedFiles.Count -eq 0) {
        $classification = [ordered]@{
            smokeTier = "full"
            reason = "no_changed_files"
            changedCount = 0
            changedFiles = @()
            fullTriggerFiles = @()
            legacyLaneMode = "full"
            legacyLaneReason = "no_changed_files"
            legacyLaneFullTriggerFiles = @()
        }
    } else {
        $fullTriggerFiles = @($normalizedFiles | Where-Object { -not (Test-TargetedSmokeAllowedPath $_) })
        $legacyLaneFullTriggerFiles = @($normalizedFiles | Where-Object { Test-LegacyLaneFullRequiredPath $_ })
        $legacyLaneMode = if ($legacyLaneFullTriggerFiles.Count -gt 0) { "full" } else { "sync_only" }
        $legacyLaneReason = if ($legacyLaneFullTriggerFiles.Count -gt 0) { "legacy_php_or_upload_package_changed" } else { "no_legacy_php_or_upload_package_changes" }
        if ($fullTriggerFiles.Count -gt 0) {
            $classification = [ordered]@{
                smokeTier = "full"
                reason = "ui_or_runtime_surface_changed"
                changedCount = $normalizedFiles.Count
                changedFiles = $normalizedFiles
                fullTriggerFiles = $fullTriggerFiles
                legacyLaneMode = $legacyLaneMode
                legacyLaneReason = $legacyLaneReason
                legacyLaneFullTriggerFiles = $legacyLaneFullTriggerFiles
            }
        } else {
            $classification = [ordered]@{
                smokeTier = "targeted"
                reason = "deploy_import_docs_only"
                changedCount = $normalizedFiles.Count
                changedFiles = $normalizedFiles
                fullTriggerFiles = @()
                legacyLaneMode = $legacyLaneMode
                legacyLaneReason = $legacyLaneReason
                legacyLaneFullTriggerFiles = $legacyLaneFullTriggerFiles
            }
        }
    }
}

$json = $classification | ConvertTo-Json -Depth 5
Write-Output $json

Write-GitHubOutputValue -Name "smoke_tier" -Value $classification.smokeTier
Write-GitHubOutputValue -Name "reason" -Value $classification.reason
Write-GitHubOutputValue -Name "changed_count" -Value ([string]$classification.changedCount)
Write-GitHubOutputValue -Name "legacy_lane_mode" -Value $classification.legacyLaneMode
Write-GitHubOutputValue -Name "legacy_lane_reason" -Value $classification.legacyLaneReason
