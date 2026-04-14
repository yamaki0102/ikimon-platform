# 新PC セットアップガイド

## 1. 前提ツールのインストール

```powershell
# PHP 8.2
winget install PHP.PHP.8.2

# Composer
winget install Composer.Composer

# Claude Code
npm install -g @anthropic-ai/claude-code

# Git（未インストールの場合）
winget install Git.Git
```

## 2. リポジトリのクローン

> ⚠️ Google Drive の下にクローンしないこと（.git/index.lock が同期プロセスに掴まれる）

```powershell
# ローカルに置く（例）
cd C:\dev
git clone https://github.com/yamaki0102/ikimon-platform.git ikimon.life
cd ikimon.life
```

## 3. SSH デプロイキーの配置

通常の開発には必須ではない。GitHub Actions が本番 deploy を担当する。
サーバー保守や緊急確認で SSH 接続が必要な場合だけ設定する。

```powershell
# ~/.ssh/ に production.pem を配置
# ※ キーは別途セキュアな方法で受け取ること（パスワードマネージャー等）
mkdir ~/.ssh
# production.pem をここに置く

# パーミッション設定（Windows では icacls を使用）
icacls "$env:USERPROFILE\.ssh\production.pem" /inheritance:r /grant:r "$env:USERNAME:R"
```

SSH 接続先:
```
Host: r1522484@www1070.onamae.ne.jp
Port: 8022
Key:  ~/.ssh/production.pem
```

## 4. ローカル開発サーバーの起動

```powershell
php -S localhost:8899 -t upload_package/public_html
```

ブラウザで http://localhost:8899/ を開く。

## 5. 動作確認

```powershell
# 構文チェック
php tools/lint.php

# テスト実行
composer install
composer test
```

## 6. Claude Code での作業開始

```powershell
cd C:\dev\ikimon.life
claude
```

`CLAUDE.md` が自動的に読み込まれ、プロジェクトのコンテキストが即座に利用可能になります。

---

## 日常の開発フロー

```powershell
# 作業前：最新を取得
git pull

# 作業後：コミット＆プッシュ
git add -p          # 変更を確認しながらステージング
git commit -m "..."
git push

# release preflight
powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_guardrails.ps1

# 本番 deploy は PR を main にマージすると GitHub Actions が実行
```

## トラブルシューティング

### git 操作が固まる
Google Drive 配下にクローンした場合に発生。ローカルパスに移動してクローンし直す。

### PHP が見つからない
```powershell
# PATH を確認・更新してターミナルを再起動
$env:PATH += ";C:\php"
```

### SSH 接続できない
```powershell
# 接続テスト
ssh -i ~/.ssh/production.pem -p 8022 r1522484@www1070.onamae.ne.jp
```
