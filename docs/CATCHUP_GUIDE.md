# Catch-Up Guide

ikimon.life は `shared-root` 構成で Web と Android が同居している。  
ファイル数が増えた今は、毎回ディレクトリを手で舐めるより、入口を固定してから深掘りした方が速い。

> **Current default:** 通常の本番 / staging / UI / API / login / record / map 調査は **必ず `platform_v2/` から開始する**。
> `upload_package/` の legacy PHP は、ユーザーが明示的に `legacy` / `PHP` / `upload_package` と言った場合、または v2 から参照される legacy boundary の調査に限る。開始時に「PHP か v2 か」を確認しない。

## まず最初の 5 分

1. `README.md` で全体像を確認
2. `docs/CATCHUP_SNAPSHOT.md` を開いて現在の規模感と主要ファイルを見る
3. 全体像に戻りたいときは `docs/IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md` を読む
4. ChatGPT export と Knowledge OS の関係を確認したいときは `docs/KNOWLEDGE_OS_BRIDGE_2026-04-14.md` を読む
5. 改装の優先順位と新しい gate を見るときは `docs/strategy/ikimon_renewal_gate_framework_2026-04-12.md` を読む
6. 直近セッションの続きなら `docs/CLAUDE_HANDOVER_2026-04-12_MULTILINGUAL_STAGING_UI.md` を先に読む
7. Claude へ現状を引き継ぐなら `docs/CLAUDE_HANDOVER_2026-04-12_RENEWAL_GATE_STATUS.md` を読む
8. Claude にレビューや ultra-plan を頼むなら `docs/CLAUDE_FEEDBACK_REQUEST_2026-04-12_RENEWAL.md` を使う
9. 多言語公開面の完了状況を確認したいときは `docs/MULTILINGUAL_PARITY_AUDIT_2026-04-12.md` を読む
10. v2 切替条件と legacy boundary を確認したいときは `docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md` を読む
11. 通常実装は `platform_v2/` を入口にして、タスクの種類に応じて下の「どこを見るか」から補助資料を選ぶ
12. 実装前に `npm --prefix platform_v2 run typecheck` または対象周辺のテストを回す

## どこを見るか

| やりたいこと | 最初に見る場所 | 補足 |
|---|---|---|
| 全体像と開発計画を把握 | `docs/IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md` | 改装, staging, canonical, v2 cutover を束ねた現行サマリー |
| 改装 gate と優先順位を確認 | `docs/strategy/ikimon_renewal_gate_framework_2026-04-12.md` | `自分が学ぶ`, `みんなの AI を育てる`, `place-first`, `monitoring acceleration` を1本の gate に束ねた現行正本 |
| Claude へ現状を引き継ぐ | `docs/CLAUDE_HANDOVER_2026-04-12_RENEWAL_GATE_STATUS.md` | renewal gate と cutover gate を混ぜずに、現状・残件・次の一手を1枚に圧縮した handover |
| Claude にレビュー / ultra-plan を頼む | `docs/CLAUDE_FEEDBACK_REQUEST_2026-04-12_RENEWAL.md` | 最近実装したものへのレビューと、次の 3〜5 ラリーの ultra-plan を返させる ready-to-send prompt |
| 企業向け改装の正しい主語を確認 | `docs/strategy/ikimon_nature_site_monitoring_acceleration_plan_2026-04-12.md` | `見える化` でなく `自然共生サイトモニタリングの高速起動` を企業導線の主語に固定する |
| 同定UI / review の stance を確認 | `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\notes\ikimon_identification_system_master_note.md` | `属止め正式許容`, `AI は候補提示`, `public claim は慎重` の判断基準 |
| 継続動機と collective AI growth の thesis を確認 | `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\domains\ikimon_product_strategy.md` | `自分が学ぶ + みんなの AI を育てる` を product spine にする broader strategy |
| 直近の続き作業 | `docs/CLAUDE_HANDOVER_2026-04-12_MULTILINGUAL_STAGING_UI.md` | 多言語対応、staging、UI hardening の現行メモ |
| 多言語公開面の完了状況 | `docs/MULTILINGUAL_PARITY_AUDIT_2026-04-12.md` | staging で確認した公開面 `ja/en/es/pt-BR` parity の監査結果 |
| v2 / legacy boundary を確認 | `docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md` | legacy PHP を触ってよい例外範囲と cutover readiness gate の運用用 checklist |
| destructive migration の merge 条件を確認 | `docs/architecture/ikimon_destructive_migration_policy_2026-04-12.md` | rollback plan なしで危険 migration を通さないための運用ルール |
| 切替条件の当日Todoを実行 | `docs/architecture/ikimon_cutover_day1_todo_2026-04-12.md` | Gate 1 / Gate 2 を1日で前進させる実務用 checklist |
| legacy write inventory の差分確認 | `scripts/check_legacy_write_inventory.ps1` | known write surface と未棚卸し候補を機械的に見る |
| legacy write inventory の優先順位づけ | `docs/architecture/ikimon_legacy_write_inventory_triage_2026-04-12.md` | `unknownCandidates` を `P0/P1/P2` に切って次の棚卸し順を決める |
| canonical 契約を確認 | `docs/architecture/ikimon_canonical_contract_table_2026-04-12.md` | place / visit / observation / evidence / condition / follow の保存契約表 |
| divergence 仕様を確認 | `docs/architecture/ikimon_canonical_divergence_minimum_spec_2026-04-12.md` | JSON と canonical の最小比較観点と pass / warn / fail 条件 |
| asset drift を確認 | `docs/architecture/ikimon_asset_path_mapping_2026-04-12.md` | `public_html/uploads` と `persistent/uploads` の mapping 表 |
| 公開ページ改修 | `platform_v2/src/` | 通常の公開 UI は v2 が正本。legacy PHP ページは明示された場合のみ |
| API 改修 | `platform_v2/src/routes/` | 通常 API は v2 routes から確認。legacy PHP API は明示された場合のみ |
| 業務ロジック追跡 | `platform_v2/src/services/` | v2 service layer を先に追う。legacy libs は boundary 調査に限る |
| UI パーツ確認 | `platform_v2/src/ui/` | v2 UI / content / client assets を先に見る |
| CLI / 保守系 | `platform_v2/src/scripts/`, repo 直下 `scripts/` | migration / seed / ops は v2 側を優先 |
| テスト確認 | `platform_v2/src/**/*.test.ts` | Node test / typecheck を優先。PHPUnit は legacy 明示時のみ |
| Android 側 | `mobile/android/ikimon-pocket/app/src/main/` | WebView shell + pocket 機能 |
| 仕様・引き継ぎ | `docs/`, `readme/`, `要件/` | 最新の運用メモは `docs/` を優先 |

## 主要ルート

| パス | 役割 |
|---|---|
| `platform_v2/` | 通常の本番 / staging 正本 runtime |
| `platform_v2/src/routes/` | v2 API / page route |
| `platform_v2/src/services/` | v2 domain service |
| `upload_package/public_html/` | legacy compatibility。通常入口にしない |
| `upload_package/libs/` | legacy PHP domain logic。通常実装で触らない |
| `upload_package/config/` | 設定・秘匿情報。原則触らない |
| `upload_package/data/` | データストア。手編集禁止 |
| `tests/` | PHPUnit |
| `docs/` | 現在進行中の計画・運用知識 |
| `readme/` | 長期メモ・アーカイブ寄り知識 |
| `scripts/` | repo 運用用スクリプト |
| `mobile/android/ikimon-pocket/` | Android アプリ |

## 日常コマンド

```powershell
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
powershell -ExecutionPolicy Bypass -File .\scripts\generate_catchup_snapshot.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\generate_workspace_from_manifest.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_catchup_sync.ps1
```

## 迷ったときの判断順

1. まず `platform_v2/src/routes/` の入口 route を特定する
2. そこから v2 の service / UI / content / db migration を辿る
3. 仕様判断が必要なら `docs/` を見る
4. 過去経緯まで必要なときだけ `readme/` や `要件/` に降りる
5. legacy PHP は、明示指示または v2 から参照される boundary が確認できた場合だけ見る

## 更新ルール

- 構造を大きく変えたら `scripts/generate_catchup_snapshot.ps1` を再実行する
- 新しい定番入口を作ったら `docs/catchup_manifest.json` を先に更新し、そのあと必要ならこのガイドを直す
- 一時ファイルや検証ファイルは repo 直下に増やし続けず、用途別ディレクトリへ寄せる

## 長期運用ルール

- `docs/catchup_manifest.json` を入口定義の正本とする
- 半年に一度、manifest の `entryPoints` と `excludeTopLevelDirectories` を棚卸しする
- `docs/CATCHUP_SNAPSHOT.md` は手編集しない。必ずスクリプト再生成する
- `ikimon.life.code-workspace` は手編集しない。manifest 更新後に再生成する
- docs のうち現役運用は `docs/`、履歴保管は `readme/` に寄せる
- PR 前に `scripts/check_catchup_sync.ps1` を通す

## 数年後でも壊れにくくする原則

1. 人の記憶ではなく `catchup_manifest.json` に構造知識を寄せる
2. 入口を増やしたら manifest を更新し、README と生成物を追従させる
3. 一時用途のフォルダを恒久入口に混ぜない
4. 10 分で全体像に戻れないなら、manifest か guide が古いとみなして更新する
