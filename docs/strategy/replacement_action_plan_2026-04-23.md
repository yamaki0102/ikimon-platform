# Replacement Action Plan — 差し替えまでの実行計画

更新日: 2026-04-23
対になる正本:
- [`replacement_final_checklist_2026-04-23.md`](./replacement_final_checklist_2026-04-23.md) — Go/No-Go 判定
- [`ikimon_public_surface_canonical_pack_2026-04-22.md`](./ikimon_public_surface_canonical_pack_2026-04-22.md) — 公開面 IA 正本

## Context

チェック表で顕在化した残課題を、差し替え当日までの実行可能タスクに落とし込む。
優先度は P0（BLOCKER: 差し替え阻止）→ P1（意思決定）→ P2（運用整備）→ P3（軽微）。

BLOCKER 要約:
1. `フィールドガイド` 残存 3ファイル（title / activeNav / 内部 AI prompt）
2. `views/dashboard_*.php` 6件の canonical pack 欠落
3. API `other` family 62件の未分類
4. Section A 全行の `decision` 欄と `owner` 欄が空

---

## Phase 0: 即時着手（合計 30–60分）— ✅ 主要 3本 完了 (2026-04-23)

### ✅ P0-A1: `フィールドガイド` → `ライブガイド` 書き換え (2026-04-23 完了)

完了 4箇所（canonical pack §5.2 の rename verdict 準拠）:

| file | line | 変更 |
|---|---|---|
| `platform_v2/src/content/short/ja/public.json` | 401–402 | title / activeNav を `ライブガイド` に |
| `platform_v2/src/ui/guideFlow.ts` | 27 | `title: "ライブガイド"` |
| `platform_v2/src/services/guideTts.ts` | 88 | system prompt を `あなたはライブガイドのナレーターです` に |

検証済: `rg フィールドガイド platform_v2/src` で 0 hit。

### P0-A2: 多言語対応確認（2026-04-23 調査、未完）

調査結果: 英語側に `Field Guide` が 12 箇所残存:
- `i18n/en.ts:22,25,28` — hero eyebrow / CTA
- `i18n/i18n.test.ts:14` — テスト期待値
- `ui/guideFlow.ts:52` — en の title
- `ui/mapExplorer.ts:258,264` — crossLensLabel / bottomSheetLens
- `content/short/en/shared.json:9,77` — nav label
- `content/short/en/public.json:16,19` — tool section lead / eyebrow
- `services/guideTts.ts:53` — コメント

**ブロッカー**: canonical pack §6 Terminology Crosswalk が **日本語側しか定義していない**。英語の
canonical public term を別途決める必要がある:
- `/lens` (`その場で調べる`) → 英語は `Field Guide` / `Lens` / `On-site Check` / `Live Help` のどれ？
- `/guide` (`ライブガイド`) → 英語は `Live Guide` / `Live Field Guide` / `Live Narration` のどれ？

→ canonical pack に英語訳セクション追加が先決。P0-A2 はそれ待ち。所要: 15分 (英語決定) + 20分 (置換)。

### P0-A3: 差し替え当日チェック自動化の前段

Section B の grep を CI で回す shell をレポジトリに追加:

```bash
# scripts/check_public_surface_terms.sh
#!/usr/bin/env bash
set -euo pipefail
FORBIDDEN=('フィールドガイド' 'フィールドスキャン' 'sponsor' 'スポンサー' 'authority policy' '権限ポリシー')
EXCLUDE='--glob=!docs/strategy/** --glob=!docs/review/**'
for term in "${FORBIDDEN[@]}"; do
  hits=$(rg -l "$term" platform_v2/src $EXCLUDE || true)
  if [ -n "$hits" ]; then
    echo "FAIL: '$term' found in:"
    echo "$hits"
    exit 1
  fi
done
echo "PASS: no forbidden terms"
```

所要: 15分。担当: TBD（DX）。

---

## Phase 1: T-24h まで（意思決定＋再分類、所要 4–8h）

### ✅ P0-B1: `views/dashboard_*.php` 6件の性質判定 (2026-04-23 完了)

結論: **dead code（orphaned partial）**。

調査手順と結果:
1. `rg 'views[/\\\\]dashboard' upload_package/public_html` → 0 hit
2. `rg 'dashboard_overview|dashboard_events|...' upload_package/public_html` → 0 hit（ファイル自身のみ）
3. `views/dashboard_overview.php` 冒頭コメントに「`showcase.php` から `$site` を受ける partial」と
   書かれているが、`showcase.php` にも include 記述なし → 書き換え時に参照が外れた残骸と推定

対応: チェック表 Section A.5 の disposition を `MISSING_INTENT_UNCLEAR` → `archive (orphaned partial)` に
更新済。差し替え対象外（本番 legacy そのままで、後日 dead code cleanup タスクで削除推奨）。

### P0-B2: API `other` 62件の再分類

手順:
1. 62件を内容ごとに以下へ振り分け:
   - `observation` family 拡張: `add_observation_photo`, `quick_post`, `delete_observation`,
     `validate_observation`, `observations`, `post_dispute` 等
   - `identification` family 拡張: `predict_species`, `taxon_suggest`, `species_*`,
     `taxon_index`, `species_claims`, `species_search`, `species_story`, `support_observation_metadata`
   - `region-stats` family 拡張: `mesh_aggregates`, `mesh_coverage`, `mesh_importance`,
     `phenology`, `distribution_check`, `recommendations`, `external_occurrences`
   - `audio` family **新設**: `analyze_audio`, `analyze_audio_perch`, `audio_batch_submit`,
     `audio_batch_status`, `audio_batch_callback`, `sound_archive_upload`,
     `sound_archive_list`, `sound_archive_identify`, `sound_archive_report`
   - `notification` family **新設**: `push_subscribe`, `get_notifications`,
     `mark_notifications_read`, `client_log`, `csp_report`
   - `user-auth` family 拡張: `manage_emails` 既存 + `toggle_follow`, `toggle_like`, `toggle_ban`,
     `update_role`, `submit_application`, `submit_nps`
   - `event-community` family 拡張: `get_daily_quests`, `personal_quest`, `goals`,
     `get_journey_map`, `get_growth_log`, `log_reflection`, `get_ghosts`, `get_event_ai_suggestion`
   - `site-report` family 拡張: `plot_report`, `plot_satellite_context`, `tnfd_leap_report`,
     `get_impact_stats`, `get_personal_report`, `get_showcase_data`
   - `walk` family 拡張: `save_snapshot`, `session_recap`, `live_detections`,
     `map_observations`, `passive_event`, `stage_transition`
   - `map` family 拡張: `geo_context`, `env_segment`, `list_sites`, `get_site_wellness`
   - `misc/utility` family **新設**: `bootstrap`, `click`, `create_field`,
     `create_stream_direct_upload`, `download_proof_package`, `exif_log`,
     `identifier_queue`, `search`, `species_card`, `species_recommendations`,
     `get_completeness`, `get_queue`, `get_wellness_summary`, `nature_score`,
     `id_reason_draft`, `android_app_release`, `voice_guide`, `twin_snapshot`,
     `health`, `admin`, `admin_action`, `update_surveyor_status`, `bio-index`, `survey`
2. Section C の family 表を 17 → 20 family（audio / notification / misc を追加）に拡張
3. `other` 行を削除

所要: 2–3時間。担当: TBD（バックエンド/API 担当）。

### P1-C1: Section A `decision` 欄の一括埋め

canonical pack §3.4 が `/admin/*` に対して一括 `keep internal` を宣言したのと同じ方式で、
カテゴリ単位の一括判断を入れる。提案デフォルト:

| カテゴリ | 一括 decision | 例外だけ個別判断 |
|---|---|---|
| A.1 公開ページ（redirect/merge 系） | `GO` | `/biodiversity_map.php`, `/android-app.php` の merge 範囲 |
| A.2 ユーザー機能 | `GO` | `/quests.php` archive の時期 |
| A.3 イベント/コミュニティ | `GO` | `/bioblitz_join.php` の merge タイミング |
| A.4 ビジネス/パートナー | `GO` | `/for-researcher.php` rewrite 内容 |
| A.5 レポート/分析 | `BLOCK` → 判定後 `GO` | `MISSING_INTENT_UNCLEAR` 6件 |
| A.6 教育/学習 | `GO` | なし |
| A.7 認証/OAuth | `GO` | なし |
| A.8 admin/ | `GO`（一括宣言済） | なし |
| A.9 staging 専用 | `GO` | なし |

owner アサイン: フロント=1名、バックエンド=1名、インフラ=1名を決めて一括割当。

所要: 1–2時間（レビューミーティング 1本）。担当: キミ（意思決定者）。

### ✅ P3-D1: `replacementReadinessReport.ts` の重複削除 (2026-04-23 完了)

`:24` の重複 `/learn/methodology?lang=ja` を `/learn/identification-basics?lang=ja` に置換。
endpoint 総数は 17 を維持、beginner support ページも疎通確認対象に入った。

---

## Phase 2: T-1h まで（差し替え直前、所要 1h）

実行内容は [Section E.2](./replacement_final_checklist_2026-04-23.md#e2-t-1h直前チェック) を
そのまま実行するだけ。特に:

1. `scripts/check_public_surface_terms.sh` を実行（P0-A3 で作成）
2. readiness レポートを最新化 (`node --loader tsx src/scripts/replacementReadinessReport.ts`)
3. レガシー PHP origin のヘルスチェック（`legacy_continued` family の依存先が生きていること）
4. edge で `/api/dev_*`, `*debug*`, `verify_*` が 404/403 を返す確認

### P2-E1: rollback runbook 整備（所要 1–2h、事前着手推奨）

現状 TBD。以下の 5 ステップ程度で書く:

1. トリガー条件: Section E.3–E.5 の hard_stop FAIL、or H1 エラーレート急上昇
2. 判断者: 誰が rollback 号令を出すか
3. 手順: DNS を旧 origin に戻す / CDN ルール差し戻し / staging を 503 にする
4. 通知: ユーザー向け告知テンプレ
5. 事後処理: incident report 書式

所要: 1–2h。担当: インフラ担当 + キミ。Phase 1 と並行で着手。

---

## Phase 3: 差し替え当日（T-0 〜 T+1h）

[Section E.3–E.5](./replacement_final_checklist_2026-04-23.md#e3-t-0差し替え瞬間) を
上から順に塗る。hard_stop 集計欄を末尾に必ず埋めて意思決定ログとして保存する。

---

## Phase 4: ポスト差し替え（当日〜翌日）

### P2-F1: canary 監視の 24h 継続

- エラーレート / LCP / API p95 を 15分おきにサンプリング
- `/record` POST, `/map` 描画, `/specialist/review-queue` の 3 本だけは 5分おき smoke

### P2-F2: 文書整理

- `replacement_final_checklist_2026-04-23.md` を read-only 化 + 差し替え結果サマリ追記
- canonical pack に差し替え完了日を追記
- このアクションプランも改訂履歴を追加してクローズ

### P3-F3: レガシー PHP origin の段階撤去

差し替え完了後 1週間は `legacy_continued` family をそのまま動かす。1週間後から以下:

1. まず観察系（observation / identification）以外の family を staging 側に完全移行
2. observation / identification は v2 migration plan に従う（別文書）
3. `other` → 新 family に再分類したルートを優先移行

---

## 優先度サマリ（差し替え D-Day 逆算）

| 優先度 | タスク | 所要 | 着手タイミング |
|---|---|---|---|
| P0 | A1 フィールドガイド文言修正 | 10分 | 即時 |
| P0 | A2 多言語対応確認 | 10分 | 即時 |
| P0 | A3 grep CI スクリプト | 15分 | 即時 |
| P0 | B1 views/dashboard 判定 | 30分 | 本日中 |
| P0 | B2 API `other` 再分類 | 2-3h | T-48h まで |
| P1 | C1 Section A decision 一括 | 1-2h | T-48h まで |
| P2 | E1 rollback runbook | 1-2h | T-48h まで |
| P3 | D1 ENDPOINTS 重複削除 | 5分 | 即時 |
| — | T-24h Section E.1 全チェック | — | 前日 |
| — | T-1h Section E.2 全チェック | — | 直前 |
| — | T-0 差し替え実行 | — | 当日 |
| — | T+15m, T+1h カナリア | — | 当日 |
| P2 | F1 canary 24h | — | 差し替え後 |
| P2 | F2 文書クローズ | 30分 | +2日 |
| P3 | F3 legacy 段階撤去 | 〜1ヶ月 | +1週 |

**最速で差し替え可能な最短ルート**: P0-A1/A2/A3/D1 を今日（合計 40分）、P0-B1/B2 と
P1-C1 と P2-E1 を 1–2 日以内（合計 5–9h）。その後 Section E.1 全 PASS で前日 GO、
当日実行。

---

## 次の一歩（Go/No-Go）

**Go なら今日やること**:
1. この計画を承認 → owner を 3名アサイン
2. P0-A1 と P3-D1 を 1 PR で片付ける（10分、私がやってもいい）
3. `views/dashboard_*.php` の include grep で partial/page 判定（私がやる）
4. API `other` 62件の分類ドラフトを別 PR で出す（私がやる、レビュー待ち）

**No-Go なら**:
- どこに引っかかるか教えて。Section A の一括 decision 方式が粗すぎるなら個別化する、
  rollback runbook の体裁を先に決めたいならそれを優先、など対応する。

---

## 改訂履歴

| date | author | change |
|---|---|---|
| 2026-04-23 | 愛 (Claude) | 初版。チェック表で顕在化した P0–P3 課題を Phase 0–4 に配置。最短 5–9h で差し替え可能と試算 |
