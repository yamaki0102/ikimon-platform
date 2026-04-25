# Catch-Up Snapshot

Manifest: docs/catchup_manifest.json (v1)

## Scale

| Area | Count |
|---|---:|
| Top-level directories | 13 |
| Public PHP pages | 94 |
| API PHP files | 185 |
| Library PHP files | 150 |
| Test PHP files | 28 |
| Android source files | 37 |
| Repo / app scripts & tools | 196 |

Skipped support directories: .git, vendor, .idea, .gradle, .kotlin, .claude, .phpunit.cache, _archive, _deploy_tmp, _tmp_ux_test_env, android-shell, CLI-Anything, output
Refresh policy: structure change = True, review cadence = every 6 months

## Top-Level Directories

- .agent/ : 6 files
- .github/ : 3 files
- .vscode/ : 3 files
- dev_tools/ : 11 files
- docs/ : 224 files
- mobile/ : 69 files
- ops/ : 22 files
- platform_v2/ : 316 files
- readme/ : 22 files
- scripts/ : 25 files
- tests/ : 30 files
- tools/ : 10 files
- upload_package/ : 838 files

## API Namespaces

- upload_package\public_html\api\admin/ : 6 files
- upload_package\public_html\api\affiliate/ : 2 files
- upload_package\public_html\api\business/ : 1 files
- upload_package\public_html\api\v2/ : 61 files

## Heavy Public Pages

| File | Size KB |
|---|---:|
| upload_package\public_html\observation_detail.php | 205.5 |
| upload_package\public_html\post.php | 115.7 |
| upload_package\public_html\field_research.php | 114.2 |
| upload_package\public_html\map.php | 111.6 |
| upload_package\public_html\id_workbench.php | 110.2 |
| upload_package\public_html\site_dashboard.php | 105.6 |
| upload_package\public_html\profile.php | 74.1 |
| upload_package\public_html\guide\ikimon-approach.php | 73.4 |
| upload_package\public_html\api\v2\voice_guide.php | 71.9 |
| upload_package\public_html\index.php | 69.5 |

## Heavy Library Files

| File | Size KB |
|---|---:|
| upload_package\libs\AiObservationAssessment.php | 60.4 |
| upload_package\libs\CanonicalStore.php | 39.3 |
| upload_package\libs\BioUtils.php | 39.3 |
| upload_package\libs\ContributionLedger.php | 35.6 |
| upload_package\libs\OmoikaneInferenceEnhancer.php | 27.7 |
| upload_package\libs\Services\MyZukanService.php | 26.5 |
| upload_package\libs\Taxonomy.php | 25.5 |
| upload_package\libs\Services\ZukanService.php | 23.3 |
| upload_package\libs\OmoikaneDB.php | 22.7 |
| upload_package\libs\AiAssessmentQueue.php | 21.4 |


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
