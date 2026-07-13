param(
    [string]$ManifestPath = "ops/deploy/staging_manifest.json",
    [string]$PortableReleaseScriptPath = "scripts/run_cloudflare_staging_release.sh"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestFullPath = Join-Path $repoRoot $ManifestPath
$scriptFullPath = Join-Path $repoRoot $PortableReleaseScriptPath
$issues = New-Object System.Collections.Generic.List[string]

if (-not (Test-Path $manifestFullPath)) { throw "Staging manifest not found: $manifestFullPath" }
if (-not (Test-Path $scriptFullPath)) { throw "Portable staging release script not found: $scriptFullPath" }

$manifest = Get-Content -Raw -Path $manifestFullPath | ConvertFrom-Json
$scriptText = Get-Content -Raw -Path $scriptFullPath

if ($manifest.platform -ne "cloudflare_worker" -or $manifest.strategy -ne "cloudflare_queue_sandbox_executor") {
    $issues.Add("Staging must use the Cloudflare Queue/Sandbox Executor strategy")
}
if ($manifest.githubActionsRequired -ne $false) {
    $issues.Add("GitHub Actions must not be required for staging")
}
$promotion = $manifest.promotion
if (-not $promotion.commandBusOnly -or -not $promotion.pinCommitSha -or -not $promotion.serializeAllDeploys -or -not $promotion.trustedReleaseControls) {
    $issues.Add("Staging promotion must be command-bus-only, exact-SHA pinned, serialized, and trusted")
}
if ($promotion.sourceFetchMethod -ne "github_api_or_git_exact_sha" -or $promotion.executorIsolation -ne "one_fresh_sandbox_per_job") {
    $issues.Add("Staging source fetch and Sandbox isolation contract is incomplete")
}

foreach ($workflow in @("deploy.yml", "deploy-staging.yml", "deploy-cloudflare-staging.yml", "cloudflare-quick-preflight.yml", "cloudflare-shadow-release.yml")) {
    if (Test-Path (Join-Path $repoRoot ".github/workflows/$workflow")) {
        $issues.Add("Retired deploy workflow remains: $workflow")
    }
}

foreach ($marker in @("DEPLOY_STAGING", "APPLY_STAGING_MIGRATIONS", "SYNC_STAGING_WRITE_SECRET", "deploy:staging:dry-run", "materialize:original-ui", "STAGING_BASE_URL")) {
    if ($scriptText -notmatch [regex]::Escape($marker)) {
        $issues.Add("Portable staging release script is missing marker: $marker")
    }
}
if ($scriptText -match 'wrangler\s+d1\s+migrations\s+apply') {
    $issues.Add("Staging deploy entrypoint must not apply D1 migrations")
}
if ($scriptText -match 'VPS_SSH_KEY|ssh -i|162\.43\.44\.131|/var/www/ikimon\.life-staging') {
    $issues.Add("Staging deploy entrypoint must not reference the legacy VPS lane")
}

if ($issues.Count -gt 0) {
    foreach ($issue in $issues) { Write-Error $issue }
    exit 1
}

Write-Output "Cloudflare staging manifest and portable command-bus release script are in sync."
exit 0
