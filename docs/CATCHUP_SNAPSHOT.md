# Catch-Up Snapshot

Manifest: docs/catchup_manifest.json (schema 2)

## Scale

| Area | Count |
|---|---:|
| Top-level directories | 13 |
| Current app routes | 103 |
| Current app services | 384 |
| Current app UI helpers | 61 |
| Current app content files | 88 |
| Current app tests | 259 |
| Current app E2E specs | 36 |
| Database migrations | 131 |
| Android source files | 41 |

Skipped support directories: .git, vendor, .idea, .gradle, .kotlin, .claude, .phpunit.cache, _archive, _deploy_tmp, _tmp_ux_test_env, android-shell, CLI-Anything, output, upload_package
Skipped nested path prefixes: docs/archive/
Refresh policy: structure change = True, review cadence = every 6 months

## Top-Level Directories

- .agent/ : 6 files
- .github/ : 18 files
- .vscode/ : 3 files
- dev_tools/ : 11 files
- docs/ : 255 files
- mobile/ : 70 files
- ops/ : 40 files
- platform_v2/ : 1145 files
- readme/ : 22 files
- scripts/ : 36 files
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
- platform_v2\src\routes/ : 103 files
- platform_v2\src\scripts/ : 125 files
- platform_v2\src\services/ : 384 files
- platform_v2\src\types/ : 1 files
- platform_v2\src\ui/ : 61 files

## Largest Route Files

| File | Size KB |
|---|---:|
| platform_v2\src\routes\read.ts | 1364.8 |
| platform_v2\src\routes\guideRecordsDebug.ts | 91.1 |
| platform_v2\src\routes\marketing.ts | 82.2 |
| platform_v2\src\routes\observationDetailFriendlyCopy.test.ts | 75.6 |
| platform_v2\src\routes\write.ts | 49.7 |
| platform_v2\src\routes\record.routes.test.ts | 48.3 |
| platform_v2\src\routes\adminDataHealth.ts | 47.2 |
| platform_v2\src\routes\guideApi.ts | 46.7 |
| platform_v2\src\routes\observationEventApi.ts | 42.1 |
| platform_v2\src\routes\ops.ts | 36.7 |

## Largest Service Files

| File | Size KB |
|---|---:|
| platform_v2\src\services\observationReassess.ts | 119.4 |
| platform_v2\src\services\municipalWalkMap.ts | 113.6 |
| platform_v2\src\services\landingSnapshot.ts | 96.8 |
| platform_v2\src\services\readModels.ts | 88 |
| platform_v2\src\services\regionalStory.ts | 75.2 |
| platform_v2\src\services\mapSnapshot.ts | 74.7 |
| platform_v2\src\services\referenceLibrary.ts | 65.2 |
| platform_v2\src\services\areaPlaceSnapshot.ts | 57.3 |
| platform_v2\src\services\areaPolygons.ts | 52.1 |
| platform_v2\src\services\observationWrite.ts | 48.4 |


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
