---
description: JJ/Git スナップショット → GitHub Push。Google Drive lock 対策として GitHub API フォールバック付き。
---
// turbo-all

# /snapshot — スナップショット & Push

> コード変更を GitHub にコミット・Push する。
> Google Drive 同期による git lock 問題への対策を含む。

## 重要情報
- **ローカル git remote**: `yamaki0102/antigravity`（モノレポ）
- **ikimon コード専用リポ**: `yamaki0102/ikimon-platform`
- **Google Drive 上で git 操作する場合、`index.lock` が同期プロセスに掴まれて失敗することがある**

## Step 1: jj で試行（推奨）

```powershell
jj describe -m "<コミットメッセージ>"
jj git push
```

成功すれば完了。失敗した場合 → Step 2 へ。

## Step 2: git で試行

```powershell
# lock ファイルがあれば削除
$lockPath = "<project_root>/.git/index.lock"
if (Test-Path $lockPath) { Remove-Item -Force $lockPath }

git add -A
git commit -m "<コミットメッセージ>"
git push origin main
```

`Unable to create index.lock` エラーが出る場合 → Step 3 へ。

## Step 3: GitHub API フォールバック（lock 完全回避）

Google Drive 同期が lock を握り続ける場合、GitHub MCP の `push_files` で直接 push する。
ローカル git を完全に迂回できる。

```
# MCP Tool: mcp_github_push_files
owner: yamaki0102
repo: ikimon-platform
branch: main
files: [変更ファイルをローカルから読み取って指定]
message: "<コミットメッセージ>"
```

### ⚠️ 注意
- GitHub API 経由で push した後、ローカルの git working tree は同期されない
- 次の jj/git 操作前に `git pull` が必要になる場合がある
- `ikimon-platform` リポはローカルの `antigravity` モノレポとは**別のリポジトリ**

## Step 4: 結果確認

```powershell
# GitHub Actions の CI が走っているか確認
# → https://github.com/yamaki0102/ikimon-platform/actions
```

## 🚨 よくあるミス
1. **Google Drive が `index.lock` を掴む** → 同期完了を待つか、API フォールバックを使う
2. **antigravity リポに push してしまう** → ikimon コードは `ikimon-platform` リポが正解
3. **API push 後にローカルが古い** → `git pull` を忘れずに
