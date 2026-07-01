param(
    [string]$ManifestPath = "ops/deploy/staging_manifest.json",
    [string]$WorkflowPath = ".github/workflows/deploy-cloudflare-staging.yml"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestFullPath = if ([System.IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $repoRoot $ManifestPath }
$workflowFullPath = if ([System.IO.Path]::IsPathRooted($WorkflowPath)) { $WorkflowPath } else { Join-Path $repoRoot $WorkflowPath }

if (-not (Test-Path $manifestFullPath)) {
    throw "Staging manifest not found: $manifestFullPath"
}

if (-not (Test-Path $workflowFullPath)) {
    throw "Staging workflow not found: $workflowFullPath"
}

$manifest = Get-Content -Raw -Path $manifestFullPath | ConvertFrom-Json
$workflowText = Get-Content -Raw -Path $workflowFullPath
$issues = New-Object System.Collections.Generic.List[string]

if ($manifest.platform -eq "cloudflare_worker") {
    foreach ($requiredText in @(
        $manifest.workerName,
        $manifest.r2Bucket,
        $manifest.workerDirectory,
        "deploy:staging:dry-run",
        "materialize:original-ui",
        "target-env staging",
        "--scope staging-qa",
        "CLOUDFLARE_API_TOKEN",
        "VPS SSH/deploy",
        "Run Cloudflare staging QA sitemap smoke",
        "e2e:staging:site-map",
        "STAGING_BASE_URL: https://staging.ikimon.life",
        "playwright-report/staging"
    )) {
        if (-not [string]::IsNullOrWhiteSpace($requiredText) -and $workflowText -notmatch [regex]::Escape($requiredText)) {
            $issues.Add("deploy-cloudflare-staging.yml is missing Cloudflare staging contract text: $requiredText")
        }
    }

    foreach ($url in $manifest.healthChecks) {
        if ($workflowText -notmatch [regex]::Escape($url)) {
            $issues.Add("deploy-cloudflare-staging.yml verify step is missing health check URL: $url")
        }
    }

    foreach ($databaseName in @($manifest.d1Databases)) {
        if (-not [string]::IsNullOrWhiteSpace($databaseName) -and $workflowText -notmatch [regex]::Escape($databaseName)) {
            $issues.Add("deploy-cloudflare-staging.yml summary is missing D1 database: $databaseName")
        }
    }

    if ($workflowText -match "VPS_SSH_KEY|ssh -i|162\.43\.44\.131|/var/www/ikimon\.life-staging") {
        $issues.Add("deploy-cloudflare-staging.yml must not reference the legacy VPS staging lane")
    }

    $legacyWorkflowPath = Join-Path $repoRoot ".github/workflows/deploy-staging.yml"
    if (Test-Path $legacyWorkflowPath) {
        $legacyWorkflowText = Get-Content -Raw -Path $legacyWorkflowPath

        if ($legacyWorkflowText -notmatch "legacy_vps_public_browser_checks_retired") {
            $issues.Add("deploy-staging.yml must declare legacy_vps_public_browser_checks_retired because Cloudflare staging owns staging.ikimon.life/*")
        }

        if ($legacyWorkflowText -match "RUN_BROWSER_SMOKE=true|RUN_FULL_BROWSER_E2E=true") {
            $issues.Add("deploy-staging.yml must not re-enable public browser gates; use deploy-cloudflare-staging.yml for staging.ikimon.life browser evidence")
        }

        if ($legacyWorkflowText -notmatch 'legacy_public_browser_checks_retired=\$LEGACY_PUBLIC_BROWSER_CHECKS_RETIRED') {
            $issues.Add("deploy-staging.yml must expose legacy_public_browser_checks_retired from the plan job")
        }
    }

    if ($issues.Count -gt 0) {
        foreach ($issue in $issues) {
            Write-Error $issue
        }
        exit 1
    }

    Write-Output "Cloudflare staging manifest and workflow are in sync."
    exit 0
}

if ($workflowText -notmatch [regex]::Escape($manifest.stagingRoot)) {
    $issues.Add("deploy-staging.yml does not reference stagingRoot $($manifest.stagingRoot)")
}

foreach ($url in $manifest.healthChecks) {
    if ($workflowText -notmatch [regex]::Escape($url)) {
        $issues.Add("deploy-staging.yml verify step is missing health check URL: $url")
    }
}

if ($manifest.PSObject.Properties.Name -contains "releaseGates") {
    foreach ($gate in @($manifest.releaseGates)) {
        if (-not $gate.key) {
            $issues.Add("staging manifest release gate is missing key")
            continue
        }

        if ($workflowText -notmatch [regex]::Escape($gate.key)) {
            $issues.Add("deploy-staging.yml does not reference release gate key: $($gate.key)")
        }

        if ($gate.PSObject.Properties.Name -contains "workflowMarkers") {
            foreach ($marker in @($gate.workflowMarkers)) {
                if ($workflowText -notmatch [regex]::Escape($marker)) {
                    $issues.Add("deploy-staging.yml release gate '$($gate.key)' is missing marker: $marker")
                }
            }
        }
    }
}

if ($issues.Count -gt 0) {
    foreach ($issue in $issues) {
        Write-Error $issue
    }
    exit 1
}

Write-Output "Staging manifest and workflow are in sync."
