# v2 UI/UX Global Baseline Pass 05 (KPI最小計測)

日時: 2026-04-14
対象: staging `/v2`

## 目的
- first action rate / task completion を最小コストで取る
- UI改善の効果を定量で追える状態を作る

## 実装

1) DBテーブル追加
- `db/migrations/0006_ui_kpi_events.sql`
- 追加テーブル: `ui_kpi_events`
  - event_name: `first_action` | `task_completion`
  - event_source: `web` | `api`
  - page_path / route_key / action_key / user_id / metadata / created_at

2) KPI記録サービス
- `src/services/uiKpi.ts`
- `recordUiKpiEvent()` 追加

3) KPI受信API（webイベント）
- `src/routes/uiKpi.ts`
- `POST /api/v1/ui-kpi/events`

4) アプリ登録
- `src/app.ts`
- `registerUiKpiRoutes()` を追加

5) 自動 first_action 計測（クライアント）
- `src/ui/siteShell.ts`
- 全ページHTMLに軽量script注入
  - 最初のクリック1回だけ `first_action` 送信
  - `sessionStorage` で同一ページの重複送信を抑止

6) task_completion 計測（サーバ）
- `src/routes/write.ts`
- `POST /api/v1/observations/upsert` 成功時に
  - `task_completion` / action_key=`record_observation` を記録

## デプロイ時の実対応

- staging DBは `ikimon_v2_staging` を利用していたため、
  そのDBへ migration 相当SQLを適用
- 併せて権限付与
  - `ALTER TABLE ui_kpi_events OWNER TO ikimon_v2_staging`
  - `GRANT SELECT, INSERT, UPDATE, DELETE ON ui_kpi_events TO ikimon_v2_staging`

## 検証

1) Webイベント受信確認
- `POST /v2/api/v1/ui-kpi/events` -> `{ok:true,eventId:...}`

2) task_completion 自動記録確認
- `/api/v1/users/upsert` + `/api/v1/observations/upsert` 実行
- DB確認（直近20分）:
  - `first_action|1`
  - `task_completion|1`

## 次アクション
- first_action を CTAカテゴリ別に分類（nav / primary / secondary）
- task_completion を route別（record/photo/track）へ拡張
- 日次集計ビュー（ops用）を追加
