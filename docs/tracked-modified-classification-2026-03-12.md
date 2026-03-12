# Tracked Modified Classification (2026-03-12)

`git diff --name-only --diff-filter=M` の tracked modified を機能単位で切り分けた。

## 1. event kit

9 files

- `upload_package/libs/CorporateManager.php`
- `upload_package/public_html/api/generate_bingo_template.php`
- `upload_package/public_html/api/join_event.php`
- `upload_package/public_html/api/save_event.php`
- `upload_package/public_html/bingo.php`
- `upload_package/public_html/create_event.php`
- `upload_package/public_html/edit_event.php`
- `upload_package/public_html/event_detail.php`
- `upload_package/public_html/events.php`

## 2. for-business

5 files

- `upload_package/public_html/for-business/apply.php`
- `upload_package/public_html/for-business/demo.php`
- `upload_package/public_html/for-business/index.php`
- `upload_package/public_html/for-business/pricing.php`
- `upload_package/public_html/pricing.php`

## 3. corporate

1 file

- `upload_package/public_html/corporate_dashboard.php`

## 4. admin / analytics

29 files

- `upload_package/public_html/admin/components/sidebar.php`
- `upload_package/public_html/admin/corporate.php`
- `upload_package/public_html/admin/index.php`
- `upload_package/public_html/admin/observations.php`
- `upload_package/public_html/admin/users.php`
- `upload_package/public_html/admin/verification.php`
- `upload_package/public_html/analytics.php`
- `upload_package/public_html/api/admin/get_queue.php`
- `upload_package/public_html/api/admin/get_users.php`
- `upload_package/public_html/api/admin/verify.php`
- `upload_package/public_html/api/export_dwca.php`
- `upload_package/public_html/api/export_portfolio_dwca.php`
- `upload_package/public_html/api/export_site_csv.php`
- `upload_package/public_html/api/generate_activity_report.php`
- `upload_package/public_html/api/generate_report.php`
- `upload_package/public_html/api/generate_site_report.php`
- `upload_package/public_html/api/generate_tnfd_report.php`
- `upload_package/public_html/api/get_analytics_summary.php`
- `upload_package/public_html/api/get_fog_data.php`
- `upload_package/public_html/api/get_personal_report.php`
- `upload_package/public_html/api/get_showcase_data.php`
- `upload_package/public_html/api/save_analytics.php`
- `upload_package/public_html/csr_showcase.php`
- `upload_package/public_html/dashboard_municipality.php`
- `upload_package/public_html/demo/index.php`
- `upload_package/public_html/showcase.php`
- `upload_package/public_html/showcase_embed.php`
- `upload_package/public_html/site_dashboard.php`
- `upload_package/public_html/site_editor.php`

## 5. observation core

40 files

- `upload_package/public_html/about.php`
- `upload_package/public_html/api/ai_suggest.php`
- `upload_package/public_html/api/get_last_observation.php`
- `upload_package/public_html/api/get_observations.php`
- `upload_package/public_html/api/heatmap_data.php`
- `upload_package/public_html/api/post_identification.php`
- `upload_package/public_html/api/post_observation.php`
- `upload_package/public_html/api/save_site.php`
- `upload_package/public_html/api/save_track.php`
- `upload_package/public_html/api/taxon_index.php`
- `upload_package/public_html/api/taxon_suggest.php`
- `upload_package/public_html/assets/css/style.css`
- `upload_package/public_html/components/cookie_consent.php`
- `upload_package/public_html/components/footer.php`
- `upload_package/public_html/components/meta.php`
- `upload_package/public_html/components/nav.php`
- `upload_package/public_html/components/quick_identify.php`
- `upload_package/public_html/dashboard.php`
- `upload_package/public_html/explore.php`
- `upload_package/public_html/faq.php`
- `upload_package/public_html/for-researcher.php`
- `upload_package/public_html/guidelines.php`
- `upload_package/public_html/id_form.php`
- `upload_package/public_html/id_workbench.php`
- `upload_package/public_html/index.php`
- `upload_package/public_html/js/FieldRecorder.js`
- `upload_package/public_html/js/ai-assist.js`
- `upload_package/public_html/js/post-uploader.js`
- `upload_package/public_html/map.php`
- `upload_package/public_html/observation_detail.php`
- `upload_package/public_html/post.php`
- `upload_package/public_html/privacy.php`
- `upload_package/public_html/sitemap.php`
- `upload_package/public_html/species.php`
- `upload_package/public_html/sw.js`
- `upload_package/public_html/team.php`
- `upload_package/public_html/terms.php`
- `upload_package/public_html/updates.php`
- `upload_package/public_html/wellness.php`
- `upload_package/public_html/zukan.php`

## 6. domain libs

10 files

- `upload_package/libs/BioUtils.php`
- `upload_package/libs/DataQuality.php`
- `upload_package/libs/DataStore.php`
- `upload_package/libs/Gamification.php`
- `upload_package/libs/ObserverRank.php`
- `upload_package/libs/QuestManager.php`
- `upload_package/libs/Services/ZukanService.php`
- `upload_package/libs/StreakTracker.php`
- `upload_package/libs/TaxonData.php`
- `upload_package/libs/WellnessCalculator.php`

## 7. i18n

2 files

- `upload_package/lang/en.php`
- `upload_package/lang/ja.php`

## 8. repo meta / tests

3 files

- `AGENTS.md`
- `tests/Unit/QuestManagerTest.php`
- `tests/Unit/StreakTrackerTest.php`

## 9. scripts / tests

2 files

- `upload_package/scripts/backfill_japanese_names.php`
- `upload_package/tests/test_consensus.php`

## 運用判断

- 今回こちらが整理した staged 群は、主に `runtime data の index 除外`、`未追跡コードの Git 復帰候補`、`docs/tools` の 3 系統
- 上の tracked modified は、まだ手を付けていない既存変更として扱う
- 次に commit を切るなら、少なくとも `event kit` と `for-business` を他の群から分ける

## 再確認コマンド

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\classify_modified_tracked.ps1
```
