# Catch-Up Guide

ikimon.life の通常開発は、現行アプリを入口にしてから必要な補助資料へ降りる。旧PHPツリーは保持するが、普段の探索入口ではない。

> **Current default:** 本番 / staging / UI / API / login / record / map 調査は `platform_v2/` 配下の現行アプリから開始する。`upload_package/` は、ユーザーが `legacy` / `PHP` / `upload_package` を明示した場合、現行アプリの compatibility boundary から必要性が確認できた場合、または deploy / rollback / data-preservation 確認が必要な場合だけ見る。
> root `.ignore` により、通常の `rg` は `upload_package/` と `docs/archive/` を検索しない。必要なときだけ `rg -uuu <query> upload_package docs/archive` を使う。

## まず最初の 5 分

1. `AGENTS.md` で現行アプリ優先ルールを確認する
2. `README.md` で通常入口とコマンドを確認する
3. `docs/CATCHUP_SNAPSHOT.md` で現行アプリの規模感と主要入口を見る
4. 仕様判断が必要なら `docs/IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md` を読む
5. staging / deploy 判断が必要なら `ops/CUTOVER_RUNBOOK.md` と `docs/DEPLOYMENT.md` を読む
6. 実装前に `npm --prefix platform_v2 run typecheck` または対象周辺のテストを回す

## どこを見るか

| やりたいこと | 最初に見る場所 | 補足 |
|---|---|---|
| 公開ページ改修 | `platform_v2/src/routes/` | route から UI / service へ辿る |
| API 改修 | `platform_v2/src/routes/` | Fastify route と service contract を確認 |
| 業務ロジック追跡 | `platform_v2/src/services/` | compatibility bridge もここから辿る |
| UI パーツ確認 | `platform_v2/src/ui/` | copy は content / i18n 側も確認 |
| copy / longform | `platform_v2/src/content/` | 多言語 parity に注意 |
| DB migration | `platform_v2/db/migrations/` | destructive migration policy を確認 |
| CLI / 保守系 | `platform_v2/src/scripts/`, `scripts/` | repo 運用 script は root scripts |
| テスト確認 | `platform_v2/src/**/*.test.ts`, `platform_v2/e2e/` | Node test / typecheck を優先 |
| Android 側 | `mobile/android/ikimon-pocket/app/src/main/` | WebView shell + pocket 機能 |
| deploy / rollback | `docs/DEPLOYMENT.md`, `ops/deploy/`, `ops/CUTOVER_RUNBOOK.md` | current runtime deploy が正本 |
| legacy boundary | `platform_v2/src/legacy/`, `platform_v2/src/config.ts` | 旧PHPを直接入口にしない |
| historical docs | `docs/archive/` | 通常検索から除外。過去経緯が必要な場合だけ見る |

## 主要ルート

| パス | 役割 |
|---|---|
| `platform_v2/` | 現行アプリの物理ディレクトリ |
| `platform_v2/src/routes/` | API / page route |
| `platform_v2/src/services/` | domain service |
| `platform_v2/src/ui/` | UI rendering helper |
| `platform_v2/src/content/` | public copy / longform content |
| `platform_v2/db/migrations/` | canonical DB migration |
| `scripts/` | repo 運用用スクリプト |
| `docs/` | 現在進行中の計画・運用知識 |
| `readme/` | 長期メモ・アーカイブ寄り知識 |
| `mobile/android/ikimon-pocket/` | Android アプリ |
| `upload_package/` | legacy compatibility archive。通常入口にしない |

## 日常コマンド

```powershell
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
powershell -ExecutionPolicy Bypass -File .\scripts\generate_catchup_snapshot.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\generate_workspace_from_manifest.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_catchup_sync.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_legacy_entrypoint_reason.ps1
```

## 迷ったときの判断順

1. まず `platform_v2/src/routes/` の入口 route を特定する
2. そこから service / UI / content / db migration を辿る
3. 仕様判断が必要なら `docs/` を見る
4. 過去経緯まで必要なときだけ `readme/` や `要件/` に降りる
5. legacy PHP は、明示指示、compatibility boundary、deploy/rollback/data-preservation の根拠がある場合だけ見る

## 更新ルール

- 構造を大きく変えたら `scripts/generate_catchup_snapshot.ps1` を再実行する
- 新しい定番入口を作ったら `docs/catchup_manifest.json` を先に更新し、そのあと必要ならこのガイドを直す
- 一時ファイルや検証ファイルは repo 直下に増やし続けず、用途別ディレクトリへ寄せる

## 長期運用ルール

- `docs/catchup_manifest.json` を入口定義の正本とする
- 半年に一度、manifest の `entryPoints` と `excludeTopLevelDirectories` を棚卸しする
- `docs/CATCHUP_SNAPSHOT.md` は手編集しない。必ずスクリプト再生成する
- `ikimon.life.code-workspace` は手編集しない。manifest 更新後に再生成する
- historical docs は `docs/archive/` へ移し、active docs からのリンクだけ残す
- PR 前に `scripts/check_catchup_sync.ps1` を通す

## 数年後でも壊れにくくする原則

1. 人の記憶ではなく `catchup_manifest.json` に構造知識を寄せる
2. 入口を増やしたら manifest を更新し、README と生成物を追従させる
3. 一時用途のフォルダを恒久入口に混ぜない
4. 10 分で全体像に戻れないなら、manifest か guide が古いとみなして更新する
