---
description: 本番エラーログを手軽に確認するワンライナー集。トラブルシュート時の初手。
---
// turbo-all

# /error-log — 本番エラーログ確認

## 接続情報
- **Host**: `www1070.onamae.ne.jp`
- **Port**: `8022`
- **User**: `r1522484`
- **Key**: `~/.ssh/production.pem`
- **ログパス**: `~/logs/ikimon.life/error_log`

## Step 1: 最新エラーを確認（直近20行）
```powershell
ssh -i ~/.ssh/production.pem -p 8022 r1522484@www1070.onamae.ne.jp "tail -20 ~/logs/ikimon.life/error_log 2>/dev/null || echo 'NO_LOG_FILE'"
```

## Step 2: 重大エラーだけフィルタ（infraweb警告を除外）
```powershell
ssh -i ~/.ssh/production.pem -p 8022 r1522484@www1070.onamae.ne.jp "grep -v 'infraweb' ~/logs/ikimon.life/error_log | tail -30 2>/dev/null || echo 'NO_CRITICAL_ERRORS'"
```

## Step 3: 特定キーワードで検索（例: Permission denied）
```powershell
ssh -i ~/.ssh/production.pem -p 8022 r1522484@www1070.onamae.ne.jp "grep -i 'permission denied\|fatal\|500' ~/logs/ikimon.life/error_log | tail -20 2>/dev/null || echo 'NO_MATCHES'"
```

## Step 4: エラーログをローカルにダウンロード（詳細分析用）
```powershell
scp -P 8022 -i ~/.ssh/production.pem r1522484@www1070.onamae.ne.jp:~/logs/ikimon.life/error_log ./error_log_production.txt
```

## Step 5: エラーログのサイズ確認 & ローテーション
```powershell
ssh -i ~/.ssh/production.pem -p 8022 r1522484@www1070.onamae.ne.jp "ls -lh ~/logs/ikimon.life/error_log && wc -l ~/logs/ikimon.life/error_log"
```

## 📋 よくあるエラーパターン

| パターン | 意味 | 対処 |
|---------|------|------|
| `AH00529: Permission denied .htaccess` | ディレクトリ/ファイルのパーミッション不正 | `/deploy` Step 3.5 を再実行 |
| `PHP Fatal error: require_once` | ファイルパスが間違っている or 未アップロード | SCPで該当ファイルをアップ |
| `infraweb: Failed to set sitedata` | お名前サーバー側キャッシュ警告 | **無視OK** — サイトに影響なし |
| `PHP Warning: Undefined variable` | PHP変数の未定義 | コード修正が必要 |
