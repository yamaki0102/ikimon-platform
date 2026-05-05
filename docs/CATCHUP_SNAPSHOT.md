# Catch-Up Snapshot

Manifest: docs/catchup_manifest.json (schema 2)

## Scale

| Area | Count |
|---|---:|
| Top-level directories | 13 |
| Current app routes | 52 |
| Current app services | 216 |
| Current app UI helpers | 46 |
| Current app content files | 39 |
| Current app tests | 115 |
| Current app E2E specs | 15 |
| Database migrations | 82 |
| Android source files | 37 |

Skipped support directories: .git, vendor, .idea, .gradle, .kotlin, .claude, .phpunit.cache, _archive, _deploy_tmp, _tmp_ux_test_env, android-shell, CLI-Anything, output, upload_package
Skipped nested path prefixes: docs/archive/
Refresh policy: structure change = True, review cadence = every 6 months

## Top-Level Directories

- .agent/ : 6 files
- .github/ : 8 files
- .vscode/ : 3 files
- dev_tools/ : 11 files
- docs/ : 222 files
- mobile/ : 69 files
- ops/ : 35 files
- platform_v2/ : 642 files
- readme/ : 22 files
- scripts/ : 28 files
- tests/ : 30 files
- tmp/ : 11 files
- tools/ : 10 files

## Current App Source Areas

- platform_v2\src\config/ : 0 files
- platform_v2\src\content/ : 5 files
- platform_v2\src\copy/ : 1 files
- platform_v2\src\i18n/ : 8 files
- platform_v2\src\legacy/ : 4 files
- platform_v2\src\prompts/ : 0 files
- platform_v2\src\routes/ : 52 files
- platform_v2\src\scripts/ : 83 files
- platform_v2\src\services/ : 216 files
- platform_v2\src\types/ : 1 files
- platform_v2\src\ui/ : 46 files

## Largest Route Files

| File | Size KB |
|---|---:|
| platform_v2\src\routes\read.ts | 555 |
| platform_v2\src\routes\guideRecordsDebug.ts | 64.6 |
| platform_v2\src\routes\marketing.ts | 45.7 |
| platform_v2\src\routes\write.ts | 36.5 |
| platform_v2\src\routes\guideApi.ts | 29.5 |
| platform_v2\src\routes\observationEventApi.ts | 27.6 |
| platform_v2\src\routes\adminDataHealth.ts | 21.6 |
| platform_v2\src\routes\auth.ts | 17.7 |
| platform_v2\src\routes\observationFieldsApi.ts | 17.2 |
| platform_v2\src\routes\observationEventPages.ts | 17.1 |

## Largest Service Files

| File | Size KB |
|---|---:|
| platform_v2\src\services\regionalStory.ts | 72 |
| platform_v2\src\services\readModels.ts | 56.7 |
| platform_v2\src\services\observationReassess.ts | 53.3 |
| platform_v2\src\services\landingSnapshot.ts | 44.1 |
| platform_v2\src\services\fieldscanAudio.ts | 41.1 |
| platform_v2\src\services\observationWrite.ts | 36.7 |
| platform_v2\src\services\knowledgeNavigation.ts | 34.5 |
| platform_v2\src\services\placeSnapshot.ts | 30.9 |
| platform_v2\src\services\observationFieldRegistry.ts | 28.5 |
| platform_v2\src\services\mapSnapshot.ts | 27.5 |


## Key Entry Points

- platform_v2/src/routes/ : pages and API routes
- platform_v2/src/services/ : domain services
- platform_v2/src/ui/ : UI rendering helpers
- platform_v2/src/content/ : public copy and longform content
- platform_v2/db/migrations/ : canonical database migrations
- platform_v2/src/legacy/ : compatibility boundary from the current app
- platform_v2/e2e/ : browser QA specs
- mobile/android/ikimon-pocket/ : Android shell

## Maintenance Rules

- When adding a new stable current-app entry point, update entryPoints in this manifest.
- When adding a support directory, decide whether it should be excluded from the snapshot.
- Keep docs/CATCHUP_GUIDE.md and ikimon.life.code-workspace aligned with this manifest.
- Do not add old PHP paths as normal entry points; list them only through a proven compatibility boundary.
