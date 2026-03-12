# Deploy Allowlists

本番反映は毎回フル同期ではなく、機能単位の allowlist で行う。

## 1. for-business

- `upload_package/public_html/for-business/index.php`
- `upload_package/public_html/for-business/apply.php`
- `upload_package/public_html/for-business/demo.php`
- `upload_package/public_html/for-business/pricing.php`
- `upload_package/public_html/for-business/status.php`
- `upload_package/libs/CorporateManager.php`

## 2. event kit

- `upload_package/public_html/create_event.php`
- `upload_package/public_html/edit_event.php`
- `upload_package/public_html/event_detail.php`
- `upload_package/public_html/events.php`
- `upload_package/public_html/bingo.php`
- `upload_package/public_html/api/join_event.php`
- `upload_package/public_html/api/save_event.php`
- `upload_package/public_html/api/generate_bingo_template.php`
- `upload_package/public_html/api/get_event_leaderboard.php`
- `upload_package/libs/CorporateManager.php`

## 3. AI / taxonomy

- `upload_package/libs/AiAssessmentQueue.php`
- `upload_package/libs/AiBudgetGuard.php`
- `upload_package/libs/AiObservationAssessment.php`
- `upload_package/libs/ObservationMeta.php`
- `upload_package/libs/ObservationRecalcQueue.php`
- `upload_package/libs/SpeciesNarrative.php`
- `upload_package/libs/Taxonomy.php`
- `upload_package/public_html/api/get_observation_ai_status.php`
- `upload_package/public_html/api/propose_observation_metadata.php`
- `upload_package/public_html/api/review_observation_metadata.php`
- `upload_package/public_html/api/support_observation_metadata.php`
- `upload_package/public_html/api/update_observation.php`

## 4. corporate workspace

- `upload_package/libs/BusinessApplicationManager.php`
- `upload_package/libs/CorporateAccess.php`
- `upload_package/libs/CorporateInviteManager.php`
- `upload_package/public_html/admin/business_applications.php`
- `upload_package/public_html/api/business/submit_application.php`
- `upload_package/public_html/corporate_invite.php`
- `upload_package/public_html/corporate_members.php`
- `upload_package/public_html/corporate_settings.php`
- `upload_package/public_html/for-business/status.php`

## 5. 絶対に含めない

- `upload_package/data/**`
- `*.sqlite`
- `*.sqlite3`
- `*.sqlite3-shm`
- `*.sqlite3-wal`
- `tmp_*`
- `*.bak`
- `upload_package/data/sessions/**`
