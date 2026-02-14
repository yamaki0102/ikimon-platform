# ikimon.life — 市民参加型生物多様性プラットフォーム

## プロジェクト概要
- **目的**: 30by30・TNFD LEAP 対応の生物観察プラットフォーム
- **ステータス**: Phase 14A 完了 (2026-02-08)
- **ホスティング**: お名前ドットコム RS Plan (PHP 8.2)
- **ドメイン**: ikimon.life

## ディレクトリ構造
```
upload_package/          ← デプロイ対象 (public_html配下をサーバーへ)
├── config/              # config.php (ROOT_DIR, DATA_DIR定義)
├── data/                # JSONデータストレージ (observations, sites, redlists)
├── lang/                # 多言語ファイル
├── libs/                # PHPライブラリ群
│   ├── Auth.php
│   ├── DataStore.php    # パーティション対応JSONデータハンドラ
│   ├── SiteManager.php  # GeoJSON境界管理 (static methods only)
│   ├── RedListManager.php  # レッドリスト管理 (国＋都道府県)
│   ├── GeoUtils.php     # 地理計算
│   └── ...
├── public_html/         # Webドキュメントルート
│   ├── index.php        # フィード（ホーム）
│   ├── site_dashboard.php  # サイトダッシュボード
│   ├── api/             # APIエンドポイント群
│   │   ├── generate_site_report.php  # B2Bレポート生成
│   │   ├── save_site.php
│   │   └── ...
│   ├── components/      # UIコンポーネント
│   ├── assets/          # CSS/JS/画像
│   └── ...
├── scripts/             # メンテナンス・デプロイスクリプト
└── tools/               # ユーティリティ (lint.php 等)
```

## 重要な技術的制約

### SiteManager は全メソッド static
```php
// ✅ 正しい
$site = SiteManager::load($siteId);
$allSites = SiteManager::listAll();
SiteManager::isPointInGeometry($lat, $lng, $geometry);

// ❌ 誤り (new SiteManager() は不要)
$sm = new SiteManager();
$sm->load($siteId);
```

### DataStore メソッド名
- `DataStore::fetchAll($resource)` — 全レコード取得 (メモリ注意)
- `DataStore::get($file)` — ファイル読込
- `DataStore::save($file, $data)` — 書込
- `DataStore::append($resource, $item)` — 追記
- ⚠️ `DataStore::getAll()` は**存在しない**

### パス解決
- `ROOT_DIR` = `upload_package/` ディレクトリ
- `DATA_DIR` = `ROOT_DIR/data`
- `PUBLIC_DIR` = `ROOT_DIR/public_html`
- `$_ikimon_root` = 旧来の変数 (一部テストスクリプトで使用)

## デプロイ
- **方式**: SCP (SSH port 8022) で RS Plan へ同期。詳細は `/deploy` ワークフロー参照
- **接続**: `r1522484@www1070.onamae.ne.jp:8022` / Key: `~/.ssh/production.pem`
- **除外**: `.git`, `.vscode`, `tests/`, `debug_*.php`, `test_*.php`

### ⚠️ サーバーディレクトリ構造（罠あり）
```
~/public_html/ikimon.life/           ← サイトルート
├── .htaccess                         ← RewriteRule → public_html/ に転送
├── config/                           ← SCP先: ここ（Web非公開）
├── libs/                             ← SCP先: ここ（Web非公開）
├── data/                             ← データ（Web非公開）
└── public_html/                      ← ★ 真のWebルート ★
    ├── index.php                     ← SCP先: ここ（Web公開）
    ├── api/
    └── components/
```

**Web公開ファイルは `public_html/` 配下にアップロード**すること。  
ルート直下に置いてもHTTP 200は返るが、古いファイルが配信される罠。

## ローカル開発
```powershell
# PHP Built-in Server で検証
php -S localhost:8899 -t upload_package/public_html

# 構文チェック
php tools/lint.php

# テスト
composer test
```

## ワークフロー索引

| コマンド | ファイル | 用途 |
|---------|---------|------|
| `/deploy` | `.agent/workflows/deploy.md` | 本番デプロイ（バックアップ → SCP → 検証） |
| `/pre-release` | `.agent/workflows/pre-release.md` | リリース前品質ゲート（lint + パス + ブラウザ + API） |
| `/quick-check` | `.agent/workflows/quick-check.md` | 日常開発用 30秒チェック |
| `/systematic-debug` | `.agent/workflows/systematic-debug.md` | 構造化デバッグ（4フェーズ） |

## CI/CD (GitHub Actions)

| ワークフロー | トリガー | 内容 |
|-------------|---------|------|
| `ci.yml` | Push/PR to main | PHP Lint → PHPUnit Test |
| `deploy.yml` | 手動 (workflow_dispatch) | Pre-flight → SCP Deploy → Health Check |

## 現在のフェーズ
- ✅ Phase 13: SiteManager / GeoJSON / Dashboard / Editor
- ✅ Phase 14A: レポートMVP (RedListManager, BIS, TNFD LEAP)
- 🔲 Phase 14B: 投稿体験強化 (post.php, 同定ブリッジ)
