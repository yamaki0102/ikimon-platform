param()

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$files = git -C $repoRoot diff --name-only --diff-filter=M

$groups = [ordered]@{
    'repo-meta' = '^AGENTS\.md$|^tests/Unit/'
    'i18n' = '^upload_package/lang/'
    'event-kit' = '^upload_package/public_html/(create_event|edit_event|event_detail|events|bingo)\.php$|^upload_package/public_html/api/(join_event|save_event|generate_bingo_template)\.php$|^upload_package/libs/CorporateManager\.php$'
    'for-business' = '^upload_package/public_html/for-business/|^upload_package/public_html/pricing\.php$'
    'corporate' = '^upload_package/public_html/corporate_dashboard\.php$'
    'admin-analytics' = '^upload_package/public_html/admin/|^upload_package/public_html/analytics\.php$|^upload_package/public_html/api/admin/|^upload_package/public_html/api/get_analytics_summary\.php$|^upload_package/public_html/api/generate_(activity_report|report|site_report|tnfd_report)\.php$|^upload_package/public_html/api/export_|^upload_package/public_html/api/save_analytics\.php$|^upload_package/public_html/api/get_(personal_report|showcase_data|fog_data)\.php$|^upload_package/public_html/(csr_showcase|showcase|showcase_embed|site_dashboard|site_editor|dashboard_municipality|demo/index)\.php$'
    'observation-core' = '^upload_package/public_html/(about|dashboard|explore|faq|for-researcher|guidelines|id_form|id_workbench|index|map|observation_detail|post|privacy|sitemap|species|team|terms|updates|wellness|zukan)\.php$|^upload_package/public_html/api/(ai_suggest|get_last_observation|get_observations|heatmap_data|post_identification|post_observation|save_site|save_track|taxon_index|taxon_suggest)\.php$|^upload_package/public_html/js/|^upload_package/public_html/components/|^upload_package/public_html/assets/css/style\.css$|^upload_package/public_html/sw\.js$'
    'domain-libs' = '^upload_package/libs/(BioUtils|DataQuality|DataStore|Gamification|ObserverRank|QuestManager|StreakTracker|TaxonData|WellnessCalculator)\.php$|^upload_package/libs/Services/ZukanService\.php$'
    'scripts-tests' = '^upload_package/scripts/backfill_japanese_names\.php$|^upload_package/tests/test_consensus\.php$'
}

$results = foreach ($file in $files) {
    $group = 'unclassified'
    foreach ($key in $groups.Keys) {
        if ($file -match $groups[$key]) {
            $group = $key
            break
        }
    }

    [pscustomobject]@{
        Group = $group
        File = $file
    }
}

$results |
    Sort-Object Group, File |
    Format-Table -AutoSize
