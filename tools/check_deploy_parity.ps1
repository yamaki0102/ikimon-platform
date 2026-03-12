param(
    [string]$Group = 'all',
    [string]$RemoteAlias = 'production',
    [string]$RemoteBase = '~/public_html/ikimon.life'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$groups = [ordered]@{
    'for-business' = @(
        'upload_package/public_html/for-business/index.php',
        'upload_package/public_html/for-business/apply.php',
        'upload_package/public_html/for-business/demo.php',
        'upload_package/public_html/for-business/pricing.php',
        'upload_package/public_html/for-business/status.php',
        'upload_package/libs/CorporateManager.php'
    )
    'event-kit' = @(
        'upload_package/public_html/create_event.php',
        'upload_package/public_html/edit_event.php',
        'upload_package/public_html/event_detail.php',
        'upload_package/public_html/events.php',
        'upload_package/public_html/bingo.php',
        'upload_package/public_html/api/join_event.php',
        'upload_package/public_html/api/save_event.php',
        'upload_package/public_html/api/generate_bingo_template.php',
        'upload_package/public_html/api/get_event_leaderboard.php',
        'upload_package/libs/CorporateManager.php'
    )
    'ai-taxonomy' = @(
        'upload_package/libs/AiAssessmentQueue.php',
        'upload_package/libs/AiBudgetGuard.php',
        'upload_package/libs/AiObservationAssessment.php',
        'upload_package/libs/ObservationMeta.php',
        'upload_package/libs/ObservationRecalcQueue.php',
        'upload_package/libs/SpeciesNarrative.php',
        'upload_package/libs/Taxonomy.php',
        'upload_package/public_html/api/get_observation_ai_status.php',
        'upload_package/public_html/api/propose_observation_metadata.php',
        'upload_package/public_html/api/review_observation_metadata.php',
        'upload_package/public_html/api/support_observation_metadata.php',
        'upload_package/public_html/api/update_observation.php'
    )
    'corporate' = @(
        'upload_package/libs/BusinessApplicationManager.php',
        'upload_package/libs/CorporateAccess.php',
        'upload_package/libs/CorporateInviteManager.php',
        'upload_package/public_html/admin/business_applications.php',
        'upload_package/public_html/api/business/submit_application.php',
        'upload_package/public_html/corporate_invite.php',
        'upload_package/public_html/corporate_members.php',
        'upload_package/public_html/corporate_settings.php',
        'upload_package/public_html/for-business/status.php'
    )
}

if ($Group -eq 'all') {
    $selected = $groups.Keys
} elseif ($groups.Contains($Group)) {
    $selected = @($Group)
} else {
    throw "Unknown group: $Group"
}

$results = New-Object System.Collections.Generic.List[object]

foreach ($groupName in $selected) {
    foreach ($file in $groups[$groupName]) {
        $localPath = Join-Path $repoRoot $file
        $remotePath = $file -replace '^upload_package/', ''

        if (-not (Test-Path $localPath)) {
            $results.Add([pscustomobject]@{
                Group = $groupName
                Status = 'LOCAL_MISSING'
                File = $file
                LocalHash = ''
                RemoteHash = ''
            })
            continue
        }

        $localHash = (Get-FileHash -Algorithm SHA256 $localPath).Hash.ToLower()
        $remoteHash = (& ssh $RemoteAlias "if [ -f $RemoteBase/$remotePath ]; then sha256sum $RemoteBase/$remotePath | cut -d ' ' -f1; else echo MISSING; fi").Trim().ToLower()

        $status = if ($remoteHash -eq 'missing') { 'REMOTE_MISSING' } elseif ($remoteHash -eq $localHash) { 'MATCH' } else { 'DIFF' }

        $results.Add([pscustomobject]@{
            Group = $groupName
            Status = $status
            File = $file
            LocalHash = $localHash
            RemoteHash = $remoteHash
        })
    }
}

$results |
    Sort-Object Group, File |
    Format-Table -AutoSize
