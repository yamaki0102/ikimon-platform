# ikimon.life — 市民参加型生物多様性プラットフォーム

30by30・TNFD LEAP 対応の生物観察プラットフォーム。市民科学データの収集と、ユーザーの自己効力感を高める設計を両立する。

## 現在の開発入口

通常開発の正本は `platform_v2/` 配下の現行アプリ。旧PHPツリーはバックアップ、互換、移行検証、rollback のために保持しているが、通常の UI / API / login / record / map 調査では入口にしない。

| 領域 | 入口 |
|---|---|
| ページ・API route | `platform_v2/src/routes/` |
| ドメインロジック | `platform_v2/src/services/` |
| UI / rendering helper | `platform_v2/src/ui/` |
| 公開 copy / longform content | `platform_v2/src/content/` |
| DB migration | `platform_v2/db/migrations/` |
| E2E / browser QA | `platform_v2/e2e/` |

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Current runtime | Node.js / Fastify |
| Frontend | Alpine.js + Tailwind CSS + Lucide Icons |
| Map | MapLibre GL JS + OpenStreetMap |
| Data | PostgreSQL canonical store + compatibility data bridge |
| Deploy | GitHub Actions + VPS blue/green runtime |

## ローカル開発

```powershell
npm --prefix platform_v2 install
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
npm --prefix platform_v2 run dev
```

旧PHP互換側の調査・テストは、ユーザーが明示した場合か、現行アプリの互換境界から必要性を確認できた場合だけ行う。

## エージェント導線

- 最初に読む: `AGENTS.md`
- 通常 catch-up: `docs/CATCHUP_GUIDE.md`
- 入口定義の正本: `docs/catchup_manifest.json`
- 生成された俯瞰: `docs/CATCHUP_SNAPSHOT.md`
- workspace 生成: `powershell -ExecutionPolicy Bypass -File .\scripts\generate_workspace_from_manifest.ps1`
- 整合性チェック: `powershell -ExecutionPolicy Bypass -File .\scripts\check_catchup_sync.ps1`

## デプロイ

本番反映は `codex/<task-name>` ブランチから PR を作り、`main` merge 後の GitHub Actions で VPS へ反映する。ローカルから本番へ直接 SSH deploy しない。詳細は `docs/DEPLOYMENT.md` と `ops/deploy/deploy_manifest.json` を正本にする。

## 旧PHPの扱い

`upload_package/` は削除しない。互換書き込み、既存データ、画像、rollback、移行検証に必要な保全対象。通常開発では探索入口にせず、必要な場合だけ根拠を持って最小範囲を参照する。
