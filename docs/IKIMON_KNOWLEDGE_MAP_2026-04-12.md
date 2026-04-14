# ikimon.life Knowledge Map

更新日: 2026-04-12

目的:

- ikimon.life の重要文書を `正本 / 補助 / superseded / 運用` に分けて固定する
- 引き継ぎ漏れで判断が散るのを防ぐ
- 実装時に「まず何を読むべきか」を 1 枚で戻せるようにする

---

## 1. 最優先で見る正本

### 1.1 Product / IA の正本

- `docs/strategy/ikimon_renovation_master_plan_2026-04-11.md`
  - ikimon 改装の唯一の正本計画
  - public message, nav 5 rails, route disposition, phase order をここで固定
  - 現在の改装判断はこの文書を最優先する

### 1.2 Product decision の補助正本

- `docs/strategy/ikimon_decision_sheet_2026-04-11.md`
  - 最上位 identity を `Place Intelligence OS` と定義
  - 主役を `地元の人`
  - North Star を `active places`
  - 方向性判断で迷ったらここに戻る

### 1.3 実装順の正本

- `docs/strategy/ikimon_place_first_regional_os_execution_plan_2026-04-11.md`
  - 実装順を `message -> capture -> place -> sponsor/regional -> analytics` に固定
  - page ごとの着手順と gate を確認するときに使う

### 1.4 ファイル別仕様の正本

- `docs/spec/ikimon_place_first_regional_os_implementation_spec_2026-04-11.md`
  - route matrix
  - 各 page の新 role
  - 残す / 消す / 受け入れ条件

### 1.5 データ設計の正本

- `docs/spec/ikimon_long_term_observatory_data_principles_2026-04-11.md`
  - 100 年価値を持つ観測の 5 層
  - `taxon / evidence / effort / site condition / time series`
  - place-first product をデータに落とすときの判断基準

---

## 2. いま重要な実務 docs

### 2.1 Staging / deploy

- `docs/DEPLOYMENT.md`
  - deploy は GitHub Actions 正規ルート
  - production direct SSH deploy は正規ルートではない
- `docs/STAGING_RUNBOOK.md`
  - staging-first 運用の正本
  - `staging.162-43-44-131.sslip.io`
  - snapshot -> provision -> staging deploy -> review -> production

### 2.2 Catch-up / onboarding

- `docs/CATCHUP_GUIDE.md`
  - 新規キャッチアップの入口
- `docs/catchup_manifest.json`
  - 入口定義の正本
- `docs/CATCHUP_SNAPSHOT.md`
  - 現在構造の生成済み俯瞰

### 2.3 並行編集ルール

- `docs/shared_root_parallel_protocol.md`
  - shared-root 編集の正本
  - 同時調査可 / 同時編集不可
- `docs/agent_collaboration.md`
  - Claude / Codex の並行運用方針

---

## 3. 改装の補助線として重要な docs

### 3.1 今の staging UI 実作業

- `docs/strategy/ikimon_staging_ui_cleanup_plan_2026-04-12.md`
  - staging 公開面の cleanup 実行計画
  - `header / hero / footer / explore / profile / for-business`
  - 情報量削減、locale/width gate、copy tuning

### 3.2 readiness / gate

- `docs/strategy/ikimon_place_first_regional_os_readiness_review_2026-04-11.md`
  - place-first 計画への GO 推奨メモ
- `docs/strategy/ikimon_btobtoc_release_gate_plan_2026-04-11.md`
  - release 単位の gate / rollback 条件
  - 現在は旧命名だが、段階リリース思考として有用
- `docs/strategy/ikimon_btobtoc_route_disposition_2026-04-11.md`
  - 旧 route disposition
  - route を整理するときの参考資料

### 3.3 enterprise / monitoring acceleration の補助正本

- `docs/strategy/ikimon_nature_site_monitoring_acceleration_plan_2026-04-12.md`
  - `for-business` を `見える化` から `自然共生サイトモニタリングの高速起動` へ再定義する補助正本
  - `site quickstart`, `auto event bootstrap`, `無料枠`, `制度/行政ガードレール` の判断はここを使う

### 3.4 identification system の補助正本

- `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\notes\ikimon_identification_system_master_note.md`
  - `species certainty machine` ではなく `不確実性を保ったまま育つ同定システム` という stance の正本ノート
  - 投稿 UI, review queue, coarse rank 許容, AI suggestion, public claim の判断はここを使う

### 3.5 将来要件の監査

- `docs/strategy/ikimon_future_readiness_audit_2026-04-11.md`
  - AI, 多言語, 学校, 音声/動画, agent-safe operation の監査
  - 現在の重大ギャップを一覧化
  - とくに `正本の分裂`, `多言語の後付け`, `media = asset 化不足`, `学校運用モデル欠如` が重要

---

## 4. アーキテクチャ / 移行の正本

### 4.1 現行 PHP を続ける間の canonical 方針

- `docs/architecture/ADR-001-canonical-source-of-truth.md`
  - `ikimon.db` を canonical source として育てる判断
- `docs/architecture/canonical_migration_policy.md`
  - JSON は legacy / rollback fallback
  - `ikimon.db` は canonical schema / audit / future state
- `docs/architecture/legacy_write_inventory_2026-04-11.md`
  - 現行 legacy write surface の一覧
  - dual-write / cutover の Phase 0 inventory

### 4.2 v2 cutover の正本

- `docs/architecture/ikimon_v2_zero_base_cutover_master_plan_2026-04-11.md`
  - ゼロベース再構築と本番切替の正本
  - same VPS parallel rebuild
  - `Next.js + Fastify + PostgreSQL/PostGIS/Timescale`
  - bootstrap import / delta sync / dual-write / rollback

---

## 5. superseded 扱いだが読む価値がある docs

- `docs/strategy/ikimon_btobtoc_field_mentor_redesign_2026-04-11.md`
  - superseded by place-first master plan
  - ただし `個人が続けたくなる体験を企業が支える` の視点はまだ有用
- `docs/strategy/ikimon_btobtoc_execution_plan_2026-04-11.md`
  - superseded
- `docs/strategy/ikimon_place_first_regional_os_master_plan_2026-04-11.md`
  - 現在は `ikimon_renovation_master_plan_2026-04-11.md` に読み替える
  - place-first / regional OS の思想を理解するには重要

---

## 6. 旧世代の戦略 docs

以下は背景理解には役立つが、今の改装や migration の直接正本ではない。

- `docs/strategy/DEVELOPMENT_PLAN.md`
- `docs/strategy/development_plan_2026Q2.md`
- `docs/strategy/omoikane_v2_strategy.md`
- `docs/strategy/refactoring_roadmap.md`
- `docs/strategy/PHASE18_GEO_AI_ROADMAP.md`
- `docs/strategy/mobile_ux_strategy.md`
- `docs/strategy/habit_system_global_plan_2026-03-07.md`
- `docs/strategy/fieldscan_*`
- `docs/strategy/shizuoka_ux_improvement_plan.md`
- `docs/strategy/sprint_10day_20260325.md`

使い方:

- 直接の実装指示には使わない
- 背景文脈、未回収アイデア、技術的負債の履歴として使う

---

## 7. いま重要な衝突点

### 7.1 Product の正本は一本化されたが、data / migration は二層で走っている

- 改装の正本は `ikimon_renovation_master_plan_2026-04-11.md`
- しかし data migration は
  - 短中期: `ikimon.db` canonical 化
  - 長期: PostgreSQL v2 cutover
  の二段構え

解釈:

- UI / IA 改装は renovation master plan を正本にする
- 現行 PHP の state 管理改善は ADR-001 系を使う
- 完全刷新と本番切替は zero-base cutover を使う

### 7.2 `Place-first` と `BtoBtoC` は競合でなく、前後関係

- 旧 BtoBtoC docs は「企業が買い個人が使う」整理
- 新 plan はそれを `place-first / regional OS` に拡張
- 企業は主役から sponsor / backstage に下がっている

### 7.3 staging cleanup は戦略 docs ではなく execution memo

- `ikimon_staging_ui_cleanup_plan_2026-04-12.md` は最前線の UI 整理手順
- 戦略の正本として読むのでなく、staging 反映状況のチェックリストとして使う

---

## 8. いまの推奨読書順

### 8.1 改装タスクに入る前

1. `docs/strategy/ikimon_renovation_master_plan_2026-04-11.md`
2. `docs/strategy/ikimon_decision_sheet_2026-04-11.md`
3. `docs/spec/ikimon_place_first_regional_os_implementation_spec_2026-04-11.md`
4. `docs/strategy/ikimon_nature_site_monitoring_acceleration_plan_2026-04-12.md`
5. `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\notes\ikimon_identification_system_master_note.md`
6. `docs/strategy/ikimon_staging_ui_cleanup_plan_2026-04-12.md`

### 8.2 データ / canonical / cutover を触る前

1. `docs/spec/ikimon_long_term_observatory_data_principles_2026-04-11.md`
2. `docs/architecture/ADR-001-canonical-source-of-truth.md`
3. `docs/architecture/canonical_migration_policy.md`
4. `docs/architecture/legacy_write_inventory_2026-04-11.md`
5. `docs/architecture/ikimon_v2_zero_base_cutover_master_plan_2026-04-11.md`

### 8.3 deploy / staging を触る前

1. `docs/DEPLOYMENT.md`
2. `docs/STAGING_RUNBOOK.md`
3. `docs/shared_root_parallel_protocol.md`

---

## 9. 現時点の結論

ikimon.life の現行判断は、次の 3 本柱で読むのが最もズレにくい。

1. public / product 改装:
   - `docs/strategy/ikimon_renovation_master_plan_2026-04-11.md`
2. 現行 PHP の canonical 改善:
   - `docs/architecture/ADR-001-canonical-source-of-truth.md`
   - `docs/architecture/canonical_migration_policy.md`
3. 将来の v2 cutover:
   - `docs/architecture/ikimon_v2_zero_base_cutover_master_plan_2026-04-11.md`

この 3 本を混同せず、レイヤーを分けて扱うこと。
