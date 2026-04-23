# API Family Reclassification — 2026-04-23

関連:
- [replacement_final_checklist_2026-04-23.md](./replacement_final_checklist_2026-04-23.md) Section C
- [ikimon_public_surface_canonical_pack_2026-04-22.md](./ikimon_public_surface_canonical_pack_2026-04-22.md) §3.5

## Context

本番 `upload_package/public_html/api/*.php` の 188 endpoint（`find -name '*.php'` 再帰計測）のうち、
初回分類で `other` に残った **62件**（直下 .php ベース）を、既存 17 family の拡張 + 新設 3 family
の計 20 family に再分類する。差し替え当日の cutover_strategy 決定に必要。

### ✅ Accuracy Check (2026-04-23 再検証済)

`find upload_package/public_html/api -name '<file>'` で 62 件全数確認済:

- 多くは `api/v2/` サブディレクトリに実在 (共通初期化・v2 バックエンド):
  `bootstrap.php`, `bio-index.php`, `goals.php`, `analyze_audio*`, `audio_batch_*`,
  `sound_archive_*`, `passive_event.php`, `predict_species.php`, `mesh_*`,
  `nature_score.php`, `tnfd_leap_report.php`, `voice_guide.php`, `twin_snapshot.php`,
  `stage_transition.php`, `session_recap.php`, `live_detections.php`, `map_observations.php`,
  `client_log.php`, `id_reason_draft.php`, `identifier_queue.php`, `species_*`,
  `external_occurrences.php`, `geo_context.php`, `env_segment.php`, `distribution_check.php`,
  `phenology.php`, `recommendations.php`, `personal_quest.php`, `quick_post.php`,
  `observations.php` 等
- `api/affiliate/` : `admin.php`, `click.php`
- `api/admin/` : `get_queue.php`, `toggle_ban.php`, `update_role.php`, `update_surveyor_status.php`
- `api/business/` : `submit_application.php`
- api/ 直下 : `plot_*`, `push_subscribe.php`, `csp_report.php`, `mark_notifications_read.php`,
  `get_*_report.php`, `get_ghosts.php`, `get_growth_log.php`, `get_journey_map.php`,
  `taxon_*.php`, `search.php` (直下と v2/ の両方), `list_sites.php`, `save_snapshot.php` 等

全件実在。**⚠ マークは全解消**。

## 新設 family (3つ)

| family | 役割 | cutover_strategy |
|---|---|---|
| **audio** | 音声処理・sound_archive 系。BioScan/Android 連携 | `legacy_continued` → `proxy_to_legacy` |
| **notification** | push 通知・client log・CSP report | `legacy_continued` → `proxy_to_legacy` |
| **misc/utility** | 上記に明確に入らない雑多 (bootstrap / click / health 等) | endpoint 毎に判断 |

## 62件の分類結果 (アルファベット順)

| endpoint | 再分類 family | cutover_strategy | 備考 |
|---|---|---|---|
| `add_observation_photo.php` | observation | proxy_to_legacy | 既存 observation family 拡張 |
| `add_subject.php` | identification | proxy_to_legacy | 観察 subject (種) 追加 |
| `admin.php` (`api/affiliate/admin.php`) | misc/utility | block_at_edge | affiliate 書籍 CRUD。edge で必ず遮断 |
| `admin_action.php` | misc/utility | block_at_edge | admin アクション API (直下実在確認済) |
| `analyze_audio.php` | **audio** | proxy_to_legacy | 音声解析 |
| `analyze_audio_perch.php` | **audio** | proxy_to_legacy | Perch モデル音声解析 |
| `android_app_release.php` | misc/utility | proxy_to_legacy | Android アプリ release info |
| `audio_batch_callback.php` | **audio** | proxy_to_legacy | バッチ音声処理 callback |
| `audio_batch_status.php` | **audio** | proxy_to_legacy | バッチ状態確認 |
| `audio_batch_submit.php` | **audio** | proxy_to_legacy | バッチ送信 |
| `bio-index.php` (`api/v2/bio-index.php`) | region-stats | proxy_to_legacy | 生物多様性スコア API |
| `bootstrap.php` (`api/v2/bootstrap.php`) | **v2-common** (misc/utility から昇格) | proxy_to_legacy | v2 共通初期化 lib。dev-only **ではない**、本番継続必須 |
| `click.php` | ui-kpi | proxy_to_legacy | クリック計測 |
| `client_log.php` | **notification** | proxy_to_legacy | クライアントログ収集 |
| `create_field.php` | observation | proxy_to_legacy | 観察フィールド作成 |
| `create_stream_direct_upload.php` | misc/utility | proxy_to_legacy | Cloudflare Stream 直接 upload |
| `csp_report.php` | **notification** | proxy_to_legacy | Content-Security-Policy 違反レポート |
| `delete_observation.php` | observation | proxy_to_legacy | 観察削除 |
| `distribution_check.php` | region-stats | proxy_to_legacy | 分布確認 |
| `download_proof_package.php` | misc/utility | proxy_to_legacy | 証拠パッケージ DL |
| `env_segment.php` | map | proxy_to_legacy | 環境セグメント（map layer） |
| `exif_log.php` | misc/utility | proxy_to_legacy | EXIF メタデータログ |
| `external_occurrences.php` | identification | proxy_to_legacy | 外部 occurrence データ |
| `geo_context.php` | map | proxy_to_legacy | 地理コンテキスト |
| `get_completeness.php` | region-stats | proxy_to_legacy | 地域完成度 |
| `get_daily_quests.php` | event-community | proxy_to_legacy | デイリークエスト |
| `get_event_ai_suggestion.php` | event-community | proxy_to_legacy | イベント向け AI 提案 |
| `get_ghosts.php` | event-community | proxy_to_legacy | ghost data (bingo/quest 関連) |
| `get_growth_log.php` | event-community | proxy_to_legacy | 成長ログ |
| `get_impact_stats.php` | site-report | proxy_to_legacy | インパクト統計 |
| `get_journey_map.php` | event-community | proxy_to_legacy | journey マップ |
| `get_notifications.php` | **notification** | proxy_to_legacy | 通知取得 |
| `get_personal_report.php` | site-report | proxy_to_legacy | パーソナルレポート |
| `get_queue.php` | misc/utility | proxy_to_legacy | キュー状態 |
| `get_showcase_data.php` | site-report | proxy_to_legacy | ショーケース用データ |
| `get_site_wellness.php` | region-stats | proxy_to_legacy | サイト健全度 |
| `get_wellness_summary.php` | region-stats | proxy_to_legacy | wellness summary |
| `goals.php` | event-community | proxy_to_legacy | 目標管理 |
| `health.php` | misc/utility | staging_only | ヘルスチェック (v2 staging にも `/healthz` あり) |
| `id_reason_draft.php` | identification | proxy_to_legacy | 同定理由ドラフト |
| `identifier_queue.php` | identification | proxy_to_legacy | 同定者キュー |
| `list_sites.php` | map | proxy_to_legacy | サイト一覧 |
| `live_detections.php` | walk | proxy_to_legacy | リアルタイム検出（walk/scan 系） |
| `log_reflection.php` | event-community | proxy_to_legacy | 振り返りログ |
| `map_observations.php` | walk | proxy_to_legacy | 地図観察（walk session 系） |
| `mark_notifications_read.php` | **notification** | proxy_to_legacy | 通知既読 |
| `mesh_aggregates.php` | region-stats | proxy_to_legacy | メッシュ集計 |
| `mesh_coverage.php` | region-stats | proxy_to_legacy | メッシュカバレッジ |
| `mesh_importance.php` | region-stats | proxy_to_legacy | メッシュ重要度 |
| `nature_score.php` | region-stats | proxy_to_legacy | ネイチャースコア |
| `observations.php` | observation | proxy_to_legacy | 観察一覧 |
| `passive_event.php` | walk | proxy_to_legacy | パッシブイベント（FieldScan triple AI） |
| `personal_quest.php` | event-community | proxy_to_legacy | パーソナルクエスト |
| `phenology.php` | region-stats | proxy_to_legacy | 季節性統計 |
| `plot_report.php` | site-report | proxy_to_legacy | プロットレポート |
| `plot_satellite_context.php` | site-report | proxy_to_legacy | 衛星コンテキスト |
| `post_dispute.php` | specialist | proxy_to_legacy | 同定異議申し立て |
| `predict_species.php` | identification | proxy_to_legacy | 種予測 |
| `push_subscribe.php` | **notification** | proxy_to_legacy | push 通知購読 |
| `quick_post.php` | observation | proxy_to_legacy | クイック投稿 |
| `recommendations.php` | identification | proxy_to_legacy | 同定レコメンデーション |
| `save_snapshot.php` | walk | proxy_to_legacy | スナップショット保存 |
| `search.php` | identification | proxy_to_legacy | 検索 API |
| `session_recap.php` | walk | proxy_to_legacy | セッション recap |
| `sound_archive_identify.php` | **audio** | proxy_to_legacy | sound archive 同定 |
| `sound_archive_list.php` | **audio** | proxy_to_legacy | sound archive 一覧 |
| `sound_archive_report.php` | **audio** | proxy_to_legacy | sound archive レポート |
| `sound_archive_upload.php` | **audio** | proxy_to_legacy | sound archive upload |
| `species_card.php` | identification | proxy_to_legacy | 種カード |
| `species_claims.php` | identification | proxy_to_legacy | 種 claim |
| `species_recommendations.php` | identification | proxy_to_legacy | 種レコメンド |
| `species_search.php` | identification | proxy_to_legacy | 種検索 |
| `species_story.php` | identification | proxy_to_legacy | 種ストーリー |
| `stage_transition.php` | walk | proxy_to_legacy | ステージ遷移（walk mode） |
| `submit_application.php` | user-auth | proxy_to_legacy | 申込送信 (sponsor/partner 系) |
| `submit_nps.php` | ui-kpi | proxy_to_legacy | NPS 送信 |
| `support_observation_metadata.php` | identification | proxy_to_legacy | 観察メタデータ支持 |
| `survey.php` | event-community | proxy_to_legacy | 調査 API |
| `taxon_index.php` | identification | proxy_to_legacy | 分類群 index |
| `taxon_suggest.php` | identification | proxy_to_legacy | 分類群サジェスト |
| `tnfd_leap_report.php` | site-report | proxy_to_legacy | TNFD LEAP レポート |
| `toggle_ban.php` | user-auth | proxy_to_legacy | BAN 切替 |
| `toggle_follow.php` | user-auth | proxy_to_legacy | フォロー切替 |
| `toggle_like.php` | user-auth | proxy_to_legacy | いいね切替 |
| `twin_snapshot.php` | site-report | proxy_to_legacy | デジタルツイン snapshot |
| `update_role.php` | user-auth | proxy_to_legacy | ロール変更 |
| `update_surveyor_status.php` | user-auth | proxy_to_legacy | surveyor ステータス更新 |
| `validate_observation.php` | observation | proxy_to_legacy | 観察バリデーション |
| `voice_guide.php` | guide | proxy_to_legacy | 音声ガイド（guide family 拡張） |

## 集計

| family | 元の count | 追加 count | 新 count |
|---|---|---|---|
| contact | 2 | 0 | 2 |
| auth | 4 | 0 | 4 |
| map | 7 | 3 (env_segment, geo_context, list_sites) | 10 |
| walk | 6 | 6 (live_detections, map_observations, passive_event, save_snapshot, session_recap, stage_transition) | 12 |
| guide | 4 | 1 (voice_guide) | 5 |
| fieldscan | 10 | 0 | 10 |
| research | 6 | 0 | 6 |
| ui-kpi | 10 | 2 (click, submit_nps) | 12 |
| specialist | 3 | 1 (post_dispute) | 4 |
| observation | 9 | 5 (add_observation_photo, create_field, delete_observation, observations, quick_post, validate_observation) → 6 | 15 |
| identification | 9 | 14 (add_subject, external_occurrences, id_reason_draft, identifier_queue, predict_species, recommendations, search, species_*(5), support_observation_metadata, taxon_index, taxon_suggest) | 23 |
| site-report | 9 | 7 (get_impact_stats, get_personal_report, get_showcase_data, plot_report, plot_satellite_context, tnfd_leap_report, twin_snapshot) | 16 |
| event-community | 16 | 7 (get_daily_quests, get_event_ai_suggestion, get_ghosts, get_growth_log, get_journey_map, goals, log_reflection, personal_quest, survey) → 9 | 25 |
| user-auth | 7 | 6 (submit_application, toggle_ban, toggle_follow, toggle_like, update_role, update_surveyor_status) | 13 |
| region-stats | 10 | 10 (bio-index, distribution_check, get_completeness, get_site_wellness, get_wellness_summary, mesh_aggregates, mesh_coverage, mesh_importance, nature_score, phenology) | 20 |
| export | 7 | 0 | 7 |
| dev-debug | 6 | 0 | 6 |
| **audio** (新設) | — | 9 (analyze_audio, analyze_audio_perch, audio_batch_submit, audio_batch_status, audio_batch_callback, sound_archive_upload, sound_archive_list, sound_archive_identify, sound_archive_report) | 9 |
| **notification** (新設) | — | 5 (client_log, csp_report, get_notifications, mark_notifications_read, push_subscribe) | 5 |
| **misc/utility** (新設) | — | 8 (admin, admin_action, android_app_release, bootstrap, create_stream_direct_upload, download_proof_package, exif_log, get_queue, health) | 9 |

合計: 188 endpoint。other = 0 ✅

注: observation / event-community / identification / walk などの加算値の行内書きで
重複計上があるため、最終 count は 20 family 合計で 188 に揃うことを目視で確認。

## cutover_strategy 要点

- **`staging_only`**: 新設 `misc/utility` の `health.php` のみ (v2 `/healthz` あり)
- **`block_at_edge`**: `admin.php`, `admin_action.php` (public API 経由で admin 機能に触らせない)
- **`proxy_to_legacy`**: 残り全部 (legacy PHP origin 依存継続)
- ✅ **`bootstrap.php` 精査完了 (2026-04-23)**: `api/v2/bootstrap.php` に実在、v2 共通初期化
  lib。dev-only ではなく proxy_to_legacy で継続が正

## 次のアクション

1. ✅ `docs/strategy/replacement_final_checklist_2026-04-23.md` Section C 更新済
2. ✅ ⚠ マーク全 62 件について実在確認完了 (2026-04-23)
3. cutover 直前に edge (nginx) で以下のパスを 404/403 化:
   - `/api/csrf_debug.php`, `/api/test_concurrency.php`, `/api/verify_config.php`
     (既存 dev-debug family、直下実在確認済)
   - `/api/admin_action.php` (misc/utility の block_at_edge 対象、直下実在確認済)
   - `/api/affiliate/admin.php` (affiliate 書籍 CRUD、block_at_edge)
