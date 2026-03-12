# Production-Parity Modified Groups (2026-03-12)

tracked modified のうち、ローカルと本番の SHA256 が一致している群を記録する。

## 1. event kit

以下は `tools/check_deploy_parity.ps1 -Group event-kit` で `MATCH` を確認した。

- `upload_package/libs/CorporateManager.php`
- `upload_package/public_html/api/generate_bingo_template.php`
- `upload_package/public_html/api/get_event_leaderboard.php`
- `upload_package/public_html/api/join_event.php`
- `upload_package/public_html/api/save_event.php`
- `upload_package/public_html/bingo.php`
- `upload_package/public_html/create_event.php`
- `upload_package/public_html/edit_event.php`
- `upload_package/public_html/event_detail.php`
- `upload_package/public_html/events.php`

## 2. for-business

以下は `tools/check_deploy_parity.ps1 -Group for-business` で `MATCH` を確認した。

- `upload_package/libs/CorporateManager.php`
- `upload_package/public_html/for-business/apply.php`
- `upload_package/public_html/for-business/demo.php`
- `upload_package/public_html/for-business/index.php`
- `upload_package/public_html/for-business/pricing.php`
- `upload_package/public_html/for-business/status.php`

追加確認:

- `upload_package/public_html/pricing.php` も `MATCH`

## 3. corporate

追加確認:

- `upload_package/public_html/corporate_dashboard.php` も `MATCH`

## 4. admin / analytics

以下 29 件は個別 SHA256 比較で全件 `MATCH` を確認した。

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

## 5. domain libs / i18n

`MATCH`:

- `upload_package/libs/BioUtils.php`
- `upload_package/libs/DataQuality.php`
- `upload_package/libs/DataStore.php`
- `upload_package/libs/Gamification.php`
- `upload_package/libs/ObserverRank.php`
- `upload_package/libs/QuestManager.php`
- `upload_package/libs/Services/ZukanService.php`
- `upload_package/libs/StreakTracker.php`
- `upload_package/libs/TaxonData.php`
- `upload_package/lang/en.php`
- `upload_package/lang/ja.php`

`DIFF`:

- `upload_package/libs/WellnessCalculator.php`

## 6. observation core

`MATCH`:

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
- `upload_package/public_html/zukan.php`

`DIFF`:

- `upload_package/public_html/js/FieldRecorder.js`
- `upload_package/public_html/wellness.php`

## 解釈

- これらは `git status` 上では modified だが、`本番未反映` ではない
- 今後の差分整理では「要デプロイ候補」ではなく「Git 履歴への回収候補」として扱う
- 今の時点で本当に本番差分候補として残っているのは、主に `upload_package/libs/WellnessCalculator.php`、`upload_package/public_html/js/FieldRecorder.js`、`upload_package/public_html/wellness.php`
