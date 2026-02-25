---
description: お名前RS Planへの本番デプロイ（SCP経由）。バックアップ→アップロード→検証の3ステップ。
---
// turbo-all

# /deploy — ikimon.life 本番デプロイ

## ⚠️ 重要: ディレクトリ構造
サーバーは `.htaccess` の RewriteRule で全リクエストを `public_html/` に転送している。

```
~/public_html/ikimon.life/           ← サイトルート（.htaccess がここ）
├── .htaccess                         ← RewriteRule ^(.*)$ public_html/$1
├── config/                           ← PHP require_once で参照（Web非公開）
├── libs/                             ← PHP require_once で参照（Web非公開）
├── data/                             ← JSONデータ（Web非公開）
├── scripts/                          ← CLIスクリプト（Web非公開）
└── public_html/                      ← ★ 真のWebルート ★
    ├── index.php
    ├── api/
    ├── components/
    └── assets/
```

**Web公開ファイル** → `~/public_html/ikimon.life/public_html/` 配下  
**バックエンド専用** → `~/public_html/ikimon.life/` 直下

## 接続情報
- **Host**: `www1070.onamae.ne.jp`
- **Port**: `8022`
- **User**: `r1522484`
- **Key**: `~/.ssh/production.pem`
- **Alias**: `production`（~/.ssh/config に定義済みの場合）

## Step 1: バックアップ
```powershell
ssh -p 8022 -i ~/.ssh/production.pem r1522484@www1070.onamae.ne.jp "cd ~/public_html && tar czf ~/ikimon_backup_$(Get-Date -Format yyyyMMdd).tar.gz ikimon.life/"
```

## Step 2: バックエンドファイルのアップロード（config, libs, lang, scripts）
```powershell
$key = "$env:USERPROFILE\.ssh\production.pem"
$dest = "r1522484@www1070.onamae.ne.jp"
$port = "8022"
$root = "~/public_html/ikimon.life"
$src = "<project_root>/upload_package"

# config, libs など（Webルート外）
scp -P $port -i $key -r "$src/config" "${dest}:${root}/"
scp -P $port -i $key -r "$src/libs" "${dest}:${root}/"
scp -P $port -i $key -r "$src/lang" "${dest}:${root}/"
scp -P $port -i $key -r "$src/scripts" "${dest}:${root}/"
```

## Step 3: Web公開ファイルのアップロード（public_html/ 配下へ）
```powershell
$webroot = "~/public_html/ikimon.life/public_html"
$srcPub = "<project_root>/upload_package/public_html"

# ルートPHPファイル
Get-ChildItem -Path $srcPub -File | ForEach-Object {
    scp -P $port -i $key $_.FullName "${dest}:${webroot}/"
}

# サブディレクトリ
scp -P $port -i $key -r "$srcPub/api" "${dest}:${webroot}/"
scp -P $port -i $key -r "$srcPub/components" "${dest}:${webroot}/"
scp -P $port -i $key -r "$srcPub/assets" "${dest}:${webroot}/"
```

## Step 3.5: パーミッション修正 ⚠️必須
SCP `-r` でディレクトリをアップすると **700 (drwx------)** で作成される。
Apacheプロセスがアクセスできず **403 Forbidden** や **500 Internal Server Error** になる。

> ⚠️ トップレベルだけでなく **全サブディレクトリ** を再帰的に修正すること！
> `assets/css/`, `assets/img/` 等のサブディレクトリが 700 だと Apache が `.htaccess` を読めず 500 エラーになる。

```powershell
ssh -p $port -i $key $dest "find ${root} -type d -exec chmod 755 {} \; && find ${root} -name '.htaccess' -exec chmod 644 {} \; && find ${root} -type f -name '*.php' -exec chmod 644 {} \; && echo 'PERMISSIONS_FIXED'"
```

## Step 4: 検証（HTTPステータス + コンテンツ確認）
```powershell
# HTTPステータス確認
curl -s -o /dev/null -w "%{http_code}" https://ikimon.life/index.php
curl -s -o /dev/null -w "%{http_code}" https://ikimon.life/explore.php
curl -s -o /dev/null -w "%{http_code}" https://ikimon.life/api/get_events.php

# ★ コンテンツ検証（ステータス200だけでは不十分！古いファイルが返る可能性あり）
curl -s https://ikimon.life/index.php | Select-String "<今回の変更に含まれるユニーク文字列>"
```

## 🚨 よくあるミス
1. **Web公開ファイルをサイトルート直下にアップロードしてしまう** → `public_html/` 配下が正解
2. **HTTP 200 だけで安心する** → 古いファイルが200を返す罠。コンテンツのグリップ検証が必須
3. **PHP CLIで動くからWebでも動くと思い込む** → CLIはファイルシステムパス、Webは.htaccessリライト経由
4. **SCP -r 後にchmod 755を忘れる** → ディレクトリが700で作成され、Apache 403 Forbiddenの罠
