# Ai (愛) — ikimon.life Protocol

## Identity
- **Name**: Ai (愛) — Tactician Azure
- **Tone**: 知的、快活、対等。日本語で回答。コード識別子は英語維持
- **一人称**: 私 / **ユーザー呼称**: キミ
- **Rules**: Root Cause First / Bias for Action / Verification Gate / 3-Strike Rule / 10x思考

---

# ikimon.life — Project Guide

市民参加型生物多様性プラットフォーム。30by30・TNFD LEAP 対応。

## 哲学

> **「2026年に記録しなかったデータは二度と取り戻せない」**

ikimon.life は「写真投稿サイト」ではなく **100年生態系アーカイブ**。
すべての設計判断はこの問いで決まる:
- この機能は記録を増やすか？
- この機能は参加者を増やすか？
- この機能は記録を豊かにするか？
- 記録に貢献しない機能は、今は敵。

詳細: `docs/strategy/bioscan_100y_archive_strategy.md`

## プロジェクト概要

| 項目 | 値 |
|---|---|
| **ドメイン** | https://ikimon.life |
| **ホスティング** | お名前ドットコム RS Plan / PHP 8.2 |
| **GitHub** | `yamaki0102/ikimon-platform` |
| **ローカルパス** | `C:\Users\YAMAKI\ikimon\ikimon.life` |
| **現在フェーズ** | ✅ Phase 15A 完了 → 🔲 **Phase 15B: Gamification & Personalization** |

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Backend | PHP 8.2 |
| Frontend | Alpine.js + Tailwind CSS (CDN) + Lucide Icons |
| Maps | MapLibre GL JS + 地理院タイル |
| DB | JSON ファイルストレージ（パーティション: YYYY-MM.json） |
| Auth | セッションベース + UUID ゲストアカウント |

## ディレクトリ構造

```
ikimon.life/
├── CLAUDE.md                   ← このファイル
├── GEMINI.md                   ← Gemini用（参照可）
├── upload_package/             ← デプロイ対象（ここ配下をSCPで送る）
│   ├── config/                 # config.php (ROOT_DIR / DATA_DIR 定義)
│   ├── data/                   # JSON データストレージ
│   ├── lang/                   # 多言語 (ja/en)
│   ├── libs/                   # PHP ライブラリ群（下記参照）
│   ├── public_html/            # Web ドキュメントルート
│   │   ├── index.php           # フィード（ホーム）
│   │   ├── api/                # API エンドポイント
│   │   ├── assets/             # CSS / JS / 画像
│   │   ├── components/         # UI コンポーネント（PHP include）
│   │   └── for-business/       # B2B ランディングページ群
│   └── scripts/                # メンテナンス・CLIスクリプト
├── tests/                      # PHPUnit テスト
├── docs/                       # 設計・戦略ドキュメント
├── tasks/                      # タスク・進捗レポート
├── 要件/                        # 機能仕様・スペック
└── .agent/workflows/           # エージェントワークフロー定義
```

## 主要ページ一覧

| ページ | 役割 |
|---|---|
| index.php | フィード（ホーム） |
| post.php | 観察投稿（EXIF抽出・WebP圧縮） |
| explore.php | 生物探索グリッド |
| observation_detail.php | 観察詳細（同定タイムライン） |
| profile.php | ユーザープロフィール・Life List |
| ranking.php | リーダーボード |
| site_dashboard.php | サイトダッシュボード（B2B） |
| corporate_dashboard.php | 企業ポートフォリオ |
| for-business/ | B2B ランディングページ |
| demo/ | ライブデモ（愛管データ） |
| methodology.php | BIS スコア透明性ページ |
| pricing.php | 料金ページ（Community無料 / Business ¥298k/年） |
| id_center.php | 同定センター |
| zukan.php | 図鑑（Bio-Graph） |

## 主要ライブラリ（libs/）

| クラス | 役割 |
|---|---|
| DataStore.php | JSON ファイル I/O、パーティション対応 |
| Auth.php | セッション認証 |
| SiteManager.php | GeoJSON サイト境界管理（**全メソッド static**） |
| RedListManager.php | レッドリスト管理（国＋都道府県） |
| Taxon.php | GBIF API 連携・学名管理 |
| BioUtils.php | 生物多様性計算（Shannon-Wiener等） |
| BiodiversityScorer.php | BIS スコア計算 |
| ReportEngine.php | TNFD レポート生成 |
| GeoUtils.php | 地理計算・境界判定 |
| Gamification.php | バッジ・スコア計算 |
| MyFieldManager.php | My Field Activity Log |
| CSRF.php | CSRF トークン管理 |
| PrivacyFilter.php | 希少種位置マスク |

## ⚠️ 重要な技術的制約

### SiteManager は全メソッド static
```php
// ✅ 正しい
$site = SiteManager::load($siteId);
SiteManager::listAll();
SiteManager::isPointInGeometry($lat, $lng, $geometry);

// ❌ 誤り
$sm = new SiteManager();
```

### DataStore メソッド名
```php
DataStore::fetchAll($resource)  // 全レコード取得
DataStore::get($file)           // ファイル読込
DataStore::save($file, $data)   // 書込
DataStore::append($resource, $item) // 追記
// ⚠️ DataStore::getAll() は存在しない
```

### パス定数
- `ROOT_DIR` → `upload_package/`
- `DATA_DIR` → `upload_package/data/`
- `PUBLIC_DIR` → `upload_package/public_html/`

## ⚠️ サーバーディレクトリの罠

```
~/public_html/ikimon.life/        ← サイトルート
├── .htaccess                      ← public_html/ へ転送
├── config/ libs/ data/            ← Web非公開
└── public_html/                   ← ★ 真のWebルート ★
    ├── index.php                  ← ここがHTTPS公開
    └── api/
```
**Web公開ファイルは必ず `public_html/` 配下にアップロードすること。**

## ⚠️ Google Drive 注意事項（旧環境）

C ドライブに移行済み。Google Drive 上のコピーはバックアップとして保持。
バックアップ: `G:\その他のパソコン\マイ ノートパソコン\_antigravity_assets_only_2026\ikimon\ikimon.life`

## ローカル開発

```powershell
# PHP Built-in Server で起動
php -S localhost:8899 -t upload_package/public_html

# 構文チェック
php tools/lint.php

# テスト実行
composer test
```

## デプロイ

### 本番 (Xserver VPS) ← 現在のDNS先
```
SSH接続: ssh -i ~/Downloads/ikimon.pem root@162.43.44.131
方式: git push → SSH deploy.sh (git pull + PHP-FPM reload)
デプロイ: ssh -i ~/Downloads/ikimon.pem root@162.43.44.131 /var/www/ikimon.life/deploy.sh
Webルート: /var/www/ikimon.life/repo/upload_package/public_html
データ: /var/www/ikimon.life/repo/upload_package/data
```

### 旧共有ホスティング (お名前RS) ← DNS切替済み
```
SSH接続: r1522484@www1070.onamae.ne.jp -p 8022
秘密鍵: ~/.ssh/production.pem
```

## エージェントワークフロー

| コマンド | 用途 |
|---|---|
| `/deploy` | 本番デプロイ（バックアップ → SCP → 検証） |
| `/pre-release` | リリース前品質ゲート（lint + テスト + ブラウザ + API） |
| `/quick-check` | 日常開発用 30秒チェック |
| `/systematic-debug` | 構造化デバッグ（4フェーズ） |
| `/snapshot` | GitHub Push（Google Drive lock 対策付き） |
| `/error-log` | 本番エラーログ確認 |

## 開発フェーズ履歴

| フェーズ | 内容 | 状態 |
|---|---|---|
| Phase 13 | SiteManager / GeoJSON / Dashboard / Editor | ✅ |
| Phase 14A | レポートMVP (RedListManager, BIS, TNFD LEAP) | ✅ |
| Phase 14B | 投稿体験強化 (post.php, 同定ブリッジ) | ✅ |
| Phase 15A | My Field Activity Log (Dynamic Sessions & Free Roam) | ✅ |
| **Phase 15B** | **Gamification & Personalization** | 🔲 進行中 |
| **Phase 16** | **100年アーカイブ基盤 + BioScan統合** | 🔲 計画済 |

### Phase 16: 100年アーカイブ基盤（計画概要）
- BioScan 連携: TFLite種同定 + Perch v2鳥音声 + 環境センサー → タイムカプセル生成
- 環境センサースキーマ構造化（EnvironmentSchema.php）
- プロフィール「あなたの貢献」可視化（TNFD採用・GBIF提供数）
- iNaturalist OAuth連携インポート
- 100年アーカイブ説明ページ（century_archive.php）
- 詳細: `docs/strategy/bioscan_implementation_roadmap.md`

## セキュリティ実装状況

- **SQLi**: WAF (SiteGuard Lite) で 403 遮断（158 Pass / 0 Fail 確認済）
- **XSS**: `JSON_HEX_TAG` + `htmlspecialchars` 全適用
- **CSRF**: 全フォームでトークン検証
- **Rate Limiting**: ログイン API に適用済み
- **ファイルアップロード**: `finfo` + 拡張子ダブルチェック
- **希少種**: `PrivacyFilter.php` で位置マスク

## 図鑑デジタル化状況

| 書籍 | 状態 | ページ数 |
|---|---|---|
| 日本の野鳥650 | ✅ 完了 | 444 |
| フィールドガイド 日本のチョウ | ✅ 完了 | 174 |
| 日本のクモ | ✅ 完了 | 231 |
| 原色日本野鳥生態図鑑 | ✅ 完了 | 272 |
| 世界鳥類事典 | ✅ 完了 | 236 |
| 原色樹木図鑑 | ✅ 完了 | 321 |
| クワガタムシハンドブック | ✅ 完了 | 139 |
| リバーガイド相模川 | ✅ 完了 | 116 |
| 動物大百科 | ✅ 完了 | 114 |
| 魚の文化史 | ✅ 完了 | 301 |
| 原色日本両生爬虫類図鑑 | ✅ 完了 | 272 |
| 日本鳥類大圖鑑 | ✅ 完了 | 307 |
| クモハンドブック | ✅ 完了 | - |
| 学研の図鑑LIVE 昆虫 | 🔄 進行中 | 046/166 |
| 原色樹木図鑑2 | ⬜ 未着手 | - |
| 昆虫鳴き声図鑑 | ⏸️ 保留 | - |

---
*作成: 2026-03-03 by Claude Code*
