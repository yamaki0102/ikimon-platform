# ikimon.life BtoBtoC Analytics 仕様

更新日: 2026-04-11

対象:

- `upload_package/public_html/assets/js/analytics.js`
- `upload_package/public_html/api/save_analytics.php`
- Home / Record / Wellness / Team pages

---

## 0. 目的

今回の analytics は、広告最適化や詳細健康分析ではなく、

- 個人の初回成功体験
- 習慣化
- チーム参加
- 導線の詰まり

を測るために使う。

---

## 1. 原則

- event 数は最小限
- 個人の詳細心理状態を追跡しすぎない
- 健康改善を断定する変数名を使わない
- 企業が個人を監視しているように見えるイベントを作らない

---

## 2. イベントスキーマ

既存スキーマを拡張して継続利用する。

- `event`
- `data`
- `page`
- `session_id`
- `timestamp`
- `viewport`
- `referrer`

追加してよい補助項目:

- `user_state`: `guest | member | manager`
- `team_context`: `none | member | manager`

---

## 3. 新規イベント一覧

## 3.1 Home

- `home_cta_start`
  - trigger: Hero の主CTAクリック
  - data: `entry_variant`, `user_state`

- `home_cta_team`
  - trigger: Hero のチームCTAクリック
  - data: `entry_variant`, `user_state`

- `today_prompt_selected`
  - trigger: Today prompt 選択
  - data: `prompt_type`

## 3.2 Capture

- `capture_started`
  - trigger: 記録導線開始
  - data: `source_page`, `capture_mode`

- `capture_mode_selected`
  - trigger: `photo | note_only`
  - data: `capture_mode`

- `capture_completed`
  - trigger: 保存成功
  - data: `capture_mode`, `has_photo`, `team_context`

- `capture_next_step_clicked`
  - trigger: 保存後 CTA
  - data: `target`

## 3.3 My Rhythm

- `weekly_rhythm_viewed`
  - trigger: `wellness.php` 表示
  - data: `team_context`

- `restoration_self_reported`
  - trigger: 1問の自己申告送信
  - data: `value_bucket`

- `rhythm_next_step_clicked`
  - trigger: おすすめ散歩 / 次の一歩 CTA
  - data: `target`

## 3.4 Team

- `team_sponsor_viewed`
  - trigger: `for-business/index.php` 表示
  - data: `source`

- `team_apply_started`
  - trigger: `for-business/apply.php` form focus
  - data: `plan_interest`

- `team_workspace_viewed`
  - trigger: `corporate_dashboard.php` 表示
  - data: `workspace_plan`

- `team_prompt_clicked`
  - trigger: Team Workspace の次アクションCTA
  - data: `prompt_type`

## 3.5 Place

- `site_workspace_viewed`
  - trigger: `site_dashboard.php` 表示
  - data: `site_id`, `plan_label`

---

## 4. 既存イベントとの関係

既存:

- `page_view`
- `post_start`
- `post_submit`
- `post_success`
- `today_card_view`
- `today_card_cta`

方針:

- 既存イベントは即削除しない
- 新規イベントを優先し、旧イベントは互換レイヤーとして暫定維持

推奨:

- `post_start` -> `capture_started` へ置換
- `post_success` -> `capture_completed` へ置換
- `today_card_*` -> `today_prompt_*` に段階移行

---

## 5. save_analytics.php の変更方針

追加 whitelist 候補:

- `home_cta_start`
- `home_cta_team`
- `today_prompt_selected`
- `capture_started`
- `capture_mode_selected`
- `capture_completed`
- `capture_next_step_clicked`
- `weekly_rhythm_viewed`
- `restoration_self_reported`
- `rhythm_next_step_clicked`
- `team_sponsor_viewed`
- `team_apply_started`
- `team_workspace_viewed`
- `team_prompt_clicked`
- `site_workspace_viewed`

---

## 6. KPI 集計ルール

## 6.1 個人ファネル

- `home_cta_start / page_view(index)`
- `capture_completed / capture_started`
- `weekly_rhythm_viewed / capture_completed`

## 6.2 継続

- 7日以内に `capture_completed` または `weekly_rhythm_viewed`
- 4週以内に 2 回以上 `capture_completed`

## 6.3 チーム

- `team_apply_started / team_sponsor_viewed`
- `team_prompt_clicked / team_workspace_viewed`

---

## 7. データ保持とプライバシー

- `restoration_self_reported` は 5段階や 3段階の bucket で保存し、自由記述は取らない
- manager 画面では個人別 raw event を直接見せない
- site / team 集計は group 単位で表示する

---

## 8. Definition of Done

- 新規イベントが whitelist に登録されている
- ページごとの主要ファネルが見える
- 企業監視に見えるイベントがない
- 医療・診断を思わせる設計になっていない

