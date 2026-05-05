# Claude Project Guide

最初に `AGENTS.md` を読むこと。

このリポジトリでは、Claude Code と Codex は同じソースコードと同じプロジェクト文書を共有する。

## Shared Source Of Truth

- 共通ルール: `AGENTS.md`
- リポジトリ概要: `README.md`
- セットアップ補助: `SETUP.md`, `CODEX_SETUP.md`
- 通常開発入口: `platform_v2/` 配下の現行アプリ

## Collaboration Rules

- コード、設計メモ、仕様書は repo 内を正本にする
- `C:\Users\YAMAKI\.claude\` と `C:\Users\YAMAKI\.codex\` の内部状態は共有しない
- 調査だけなら同一 worktree で並行可
- 同時編集するなら branch を分ける
- 本格的に並行編集するなら `git worktree` を使う
- UI / API / login / record / map / staging 調査は現行アプリから始める
- `upload_package/` は legacy boundary が明確な場合だけ参照する

## Response Style

- 日本語で回答
- コード識別子は英語のまま維持
- 推測ではなく根拠ベースで進める

## Notes

- 既存の長文ルールは `AGENTS.md` に集約する
- Claude 固有の追記が必要なら、このファイルには最小差分だけを書く
