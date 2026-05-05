# Worktree Cleanup 2026-03-14

## Current state

- Branch: `codex/worktree-cleanup-20260312`
- Remaining changes after cleanup: `147`
- Noise already removed:
  - restored `upload_package/data/counts/observations/36f10578baaed608.json`
  - locally ignored `upload_package/config/affiliate.php`
  - ignored runtime data `upload_package/data/affiliate/`
- Local Git config:
  - `core.autocrlf=false`
  - `core.eol=lf`

## Recommended commit groups

### 1. Surveyor / Affiliate

Primary new files:

- `tests/Unit/SurveyorManagerTest.php`
- `upload_package/libs/AffiliateManager.php`
- `upload_package/libs/CorporatePlanGate.php`
- `upload_package/libs/SurveyRequestManager.php`
- `upload_package/libs/SurveyorManager.php`
- `upload_package/public_html/admin/surveyors.php`
- `upload_package/public_html/api/admin/update_surveyor_status.php`
- `upload_package/public_html/api/affiliate/`
- `upload_package/public_html/api/get_site_summary.php`
- `upload_package/public_html/api/report_surveyor.php`
- `upload_package/public_html/api/update_surveyor_profile.php`
- `upload_package/public_html/components/affiliate_books.php`
- `upload_package/public_html/request_survey.php`
- `upload_package/public_html/surveyor_profile.php`
- `upload_package/public_html/surveyor_profile_edit.php`
- `upload_package/public_html/surveyor_records.php`
- `upload_package/public_html/surveyors.php`
- `upload_package/tests/test_corporate_plan_gate.php`

Related modified files should be reviewed into this group when they depend on the new feature.

### 2. PWA / Icon refresh

- `upload_package/public_html/assets/img/apple-touch-icon.png`
- `upload_package/public_html/assets/img/favicon-32.png`
- `upload_package/public_html/assets/img/favicon.svg`
- `upload_package/public_html/assets/img/icon-192-maskable.png`
- `upload_package/public_html/assets/img/icon-512-maskable.png`
- `upload_package/public_html/assets/img/icon-512.png`
- `upload_package/public_html/assets/img/icon-maskable.svg`
- `upload_package/public_html/assets/img/pwa-icon-192-maskable.png`
- `upload_package/public_html/assets/img/pwa-icon-192.png`
- `upload_package/public_html/assets/img/pwa-icon-512-maskable.png`
- `upload_package/public_html/assets/img/pwa-icon-512.png`
- `upload_package/public_html/favicon.ico`
- `upload_package/public_html/manifest.json`
- `upload_package/public_html/manifest.php`
- `upload_package/public_html/sw.js`
- `upload_package/public_html/sw.php`

### 3. Existing screen / API refactors

Large existing-file changes remain in:

- `upload_package/public_html/api/`
- `upload_package/libs/`
- `upload_package/public_html/admin/`
- `upload_package/public_html/`

These should be split after `Surveyor / Affiliate` and `PWA / Icon refresh` are isolated.

## Safe next commands

Inspect feature group:

```powershell
git diff -- upload_package/libs/SurveyorManager.php
git diff -- upload_package/public_html/surveyors.php
```

Stage by feature:

```powershell
git add tests/Unit/SurveyorManagerTest.php
git add upload_package/libs/AffiliateManager.php
git add upload_package/libs/CorporatePlanGate.php
git add upload_package/libs/SurveyRequestManager.php
git add upload_package/libs/SurveyorManager.php
git add upload_package/public_html/admin/surveyors.php
git add upload_package/public_html/api/admin/update_surveyor_status.php
git add upload_package/public_html/api/affiliate
git add upload_package/public_html/api/get_site_summary.php
git add upload_package/public_html/api/report_surveyor.php
git add upload_package/public_html/api/update_surveyor_profile.php
git add upload_package/public_html/components/affiliate_books.php
git add upload_package/public_html/request_survey.php
git add upload_package/public_html/surveyor_profile.php
git add upload_package/public_html/surveyor_profile_edit.php
git add upload_package/public_html/surveyor_records.php
git add upload_package/public_html/surveyors.php
git add upload_package/tests/test_corporate_plan_gate.php
```

Then use `git add -p` for touched existing files that belong to that same feature.
