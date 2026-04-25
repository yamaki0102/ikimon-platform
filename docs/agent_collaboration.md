# Agent Collaboration

このリポジトリは Claude Code と Codex の並行利用を前提に運用する。

## Goal

- 作業フォルダはできるだけ共通化する
- ルールと文書は repo 内に集約する
- ツールの内部状態は分離する

## Shared

- Git repository
- source code
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/`

## Isolated

- `C:\Users\YAMAKI\.codex\`
- `C:\Users\YAMAKI\.claude\`
- 認証情報、履歴、ローカルキャッシュ、セッションDB

## Parallel Editing

### Light usage

- 同じフォルダを両方で開いて調査するのは可

### Safe editing

- 編集は片方ずつ行う
- もしくは branch を分ける

### Serious parallel editing

`git worktree` を使う:

```powershell
git worktree add E:\Projects\Playground_codex -b codex/playground-parallel
git worktree add E:\Projects\Playground_claude -b claude/playground-parallel
```

これで同じ repo 系統を保ちつつ、index 競合を避けられる。

## Migration Standard

- 標準ルート: `E:\Projects`
- コピー確認後に切り替える
- 旧 `C:` 側はすぐ削除しない
