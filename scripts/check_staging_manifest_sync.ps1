param(
    [string]$ManifestPath = "ops/deploy/staging_manifest.json",
    [string]$WorkflowPath = ".github/workflows/deploy-cloudflare-staging.yml",
    [string]$PortableReleaseScriptPath = "scripts/run_cloudflare_staging_release.sh"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestFullPath = if ([System.IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $repoRoot $ManifestPath }
$workflowFullPath = if ([System.IO.Path]::IsPathRooted($WorkflowPath)) { $WorkflowPath } else { Join-Path $repoRoot $WorkflowPath }
$portableReleaseScriptFullPath = if ([System.IO.Path]::IsPathRooted($PortableReleaseScriptPath)) { $PortableReleaseScriptPath } else { Join-Path $repoRoot $PortableReleaseScriptPath }

if (-not (Test-Path $manifestFullPath)) {
    throw "Staging manifest not found: $manifestFullPath"
}

if (-not (Test-Path $workflowFullPath)) {
    throw "Staging workflow not found: $workflowFullPath"
}

$manifest = Get-Content -Raw -Path $manifestFullPath | ConvertFrom-Json
$workflowText = Get-Content -Raw -Path $workflowFullPath
$deployContractText = $workflowText
$issues = New-Object System.Collections.Generic.List[string]

if ($manifest.platform -eq "cloudflare_worker") {
    if (-not (Test-Path $portableReleaseScriptFullPath)) {
        $issues.Add("Portable Cloudflare staging release script is missing: $PortableReleaseScriptPath")
    }
    else {
        $deployContractText += "`n" + (Get-Content -Raw -Path $portableReleaseScriptFullPath)
    }

    if ($manifest.PSObject.Properties.Name -notcontains "portableReleaseScript" -or $manifest.portableReleaseScript -ne $PortableReleaseScriptPath) {
        $issues.Add("staging manifest portableReleaseScript must be $PortableReleaseScriptPath")
    }

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
        if (-not [string]::IsNullOrWhiteSpace($requiredText) -and $deployContractText -notmatch [regex]::Escape($requiredText)) {
            $issues.Add("Cloudflare staging deploy contract is missing text: $requiredText")
        }
    }

    foreach ($requiredText in @(
        "group: cloudflare-staging",
        "cancel-in-progress: false",
        "commit_sha:",
        "github.event.inputs.commit_sha",
        ".release-control/scripts/check_release_candidate.ps1",
        'ref: ${{ github.sha }}',
        "refs/heads/main",
        "Require verified release candidate",
        "scripts/run_cloudflare_staging_release.sh"
    )) {
        if ($workflowText -notmatch [regex]::Escape($requiredText)) {
            $issues.Add("deploy-cloudflare-staging.yml is missing release promotion guard: $requiredText")
        }
    }

    if (-not $manifest.promotion.pinCommitSha -or -not $manifest.promotion.serializeAllDeploys -or -not $manifest.promotion.requireOpenNonDraftPullRequest -or -not $manifest.promotion.trustedReleaseControls) {
        $issues.Add("staging manifest promotion must require SHA pinning, trusted release controls, global serialization, and an open non-draft PR")
    }
    if ($manifest.promotion.workflowDispatchRef -ne "main" -or $manifest.promotion.allowPushTrigger) {
        $issues.Add("staging promotion must dispatch its trusted workflow from main and must not accept a push trigger")
    }
    if ($workflowText -match '(?m)^\s{2}push:') {
        $issues.Add("deploy-cloudflare-staging.yml must not expose the staging environment to feature-branch push workflows")
    }

    $candidateCheckPath = Join-Path $repoRoot "scripts/check_release_candidate.ps1"
    if (-not (Test-Path $candidateCheckPath)) {
        $issues.Add("Release candidate guard script is missing: scripts/check_release_candidate.ps1")
    }
    else {
        $candidateCheckText = Get-Content -Raw -Path $candidateCheckPath
        foreach ($context in @($manifest.promotion.requiredStatusContexts)) {
            if ([string]::IsNullOrWhiteSpace($context)) {
                $issues.Add("staging manifest promotion contains an empty required status context")
            }
        }
        if ($candidateCheckText -notmatch "requiredStatusContexts") {
            $issues.Add("check_release_candidate.ps1 must read promotion.requiredStatusContexts from the staging manifest")
        }
    }

    foreach ($url in $manifest.healthChecks) {
        if ($deployContractText -notmatch [regex]::Escape($url.TrimEnd('/'))) {
            $issues.Add("Cloudflare staging deploy contract is missing health check URL: $url")
        }
    }

    foreach ($databaseName in @($manifest.d1Databases)) {
        if (-not [string]::IsNullOrWhiteSpace($databaseName) -and $workflowText -notmatch [regex]::Escape($databaseName)) {
            $issues.Add("deploy-cloudflare-staging.yml summary is missing D1 database: $databaseName")
        }
    }

    if ($deployContractText -match "VPS_SSH_KEY|ssh -i|162\.43\.44\.131|/var/www/ikimon\.life-staging") {
        $issues.Add("Cloudflare staging deploy contract must not reference the legacy VPS staging lane")
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

    Write-Output "Cloudflare staging manifest, portable release script, and workflow are in sync."
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
