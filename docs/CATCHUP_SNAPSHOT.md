# Catch-Up Snapshot

Manifest: docs/catchup_manifest.json (v1)

## Scale

| Area | Count |
|---|---:|
| Top-level directories | 13 |
| Public PHP pages | 93 |
| API PHP files | 179 |
| Library PHP files | 137 |
| Test PHP files | 22 |
| Android source files | 37 |
| Repo / app scripts & tools | 177 |

Skipped support directories: .git, vendor, .idea, .gradle, .kotlin, .claude, .phpunit.cache, _archive, _deploy_tmp, _tmp_ux_test_env, android-shell, CLI-Anything, output
Refresh policy: structure change = True, review cadence = every 6 months

## Top-Level Directories

- .agent/ : 6 files
- .github/ : 2 files
- .vscode/ : 3 files
- dev_tools/ : 11 files
- docs/ : 115 files
- mobile/ : 1155 files
- ops/ : 3 files
- readme/ : 22 files
- scripts/ : 16 files
- tests/ : 54 files
- tools/ : 10 files
- upload_package/ : 2244 files
- 要件/ : 15 files

## API Namespaces

- upload_package\public_html\api\admin/ : 6 files
- upload_package\public_html\api\affiliate/ : 2 files
- upload_package\public_html\api\business/ : 1 files
- upload_package\public_html\api\v2/ : 60 files

## Heavy Public Pages

| File | Size KB |
|---|---:|
| upload_package\public_html\observation_detail.php | 155.9 |
| upload_package\public_html\field_research.php | 114.4 |
| upload_package\public_html\site_dashboard.php | 93.2 |
| upload_package\public_html\post.php | 92.5 |
| upload_package\public_html\id_workbench.php | 87.8 |
| upload_package\public_html\map.php | 80.2 |
| upload_package\public_html\guide\ikimon-approach.php | 73.4 |
| upload_package\public_html\species.php | 72 |
| upload_package\public_html\api\v2\voice_guide.php | 71.9 |
| upload_package\public_html\updates.php | 65.1 |

## Heavy Library Files

| File | Size KB |
|---|---:|
| upload_package\libs\AiObservationAssessment.php | 59.8 |
| upload_package\libs\BioUtils.php | 38.4 |
| upload_package\libs\ContributionLedger.php | 35.6 |
| upload_package\libs\Services\MyZukanService.php | 26.4 |
| upload_package\libs\OmoikaneInferenceEnhancer.php | 25.5 |
| upload_package\libs\Taxonomy.php | 25.5 |
| upload_package\libs\CanonicalStore.php | 24.5 |
| upload_package\libs\Services\ZukanService.php | 22.6 |
| upload_package\libs\AiAssessmentQueue.php | 21.4 |
| upload_package\libs\GlossaryHelper.php | 21 |


## Key Entry Points

- upload_package/public_html/index.php : feed / home
- upload_package/public_html/post.php : observation posting
- upload_package/public_html/observation_detail.php : observation detail
- upload_package/public_html/field_research.php : field research flow
- upload_package/public_html/api/ : API endpoints
- upload_package/libs/ : domain logic
- tests/ : PHPUnit suites
- mobile/android/ikimon-pocket/ : Android

## Maintenance Rules

- When adding a new stable entry point, update entryPoints in this manifest.
- When adding a support directory, decide whether it should be excluded from the snapshot.
- Keep docs/CATCHUP_GUIDE.md and ikimon.life.code-workspace aligned with this manifest.
