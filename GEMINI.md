# Gemini Project Guide

最初に `AGENTS.md` を読むこと。判断が割れる場合は `AGENTS.md` を優先する。

## Current App First

- 通常の ikimon.life 開発入口は `platform_v2/` 配下の現行アプリ。
- UI / API / login / record / map / staging 調査は `platform_v2/src/routes/` から始める。
- ロジック調査は `platform_v2/src/services/`、UI 調査は `platform_v2/src/ui/`、copy/content 調査は `platform_v2/src/content/` を優先する。
- 旧PHPツリーは互換、backup、rollback、移行検証のために残す。通常探索の入口にしない。

## Commands

```powershell
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
npm --prefix platform_v2 run dev
```

## Legacy Boundary

`upload_package/` を見るのは、ユーザーが明示した場合、現行アプリの compatibility bridge から必要性が確認できた場合、または deploy/rollback/data-preservation の確認が必要な場合だけ。旧PHP前提の古い handover や docs は historical context として扱う。

## Deployment

本番反映は PR → `main` merge → GitHub Actions の流れで行う。ローカルからの直接 deploy は使わない。正本は `docs/DEPLOYMENT.md` と `ops/deploy/deploy_manifest.json`。
