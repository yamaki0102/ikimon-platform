# ikimon.life — 市民参加型生物多様性プラットフォーム

30by30・TNFD LEAP 対応の生物観察プラットフォーム。市民科学データの収集と、ユーザーの自己効力感を高める設計を両立。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| Backend | PHP 8.2 |
| Frontend | Vanilla CSS + Alpine.js |
| Icons | Lucide Icons |
| Map | MapLibre GL JS + 地理院タイル |
| Data | JSON ファイルストレージ（パーティション対応） |
| Hosting | お名前ドットコム RS Plan |

## プロジェクト構造

```
ikimon.life/
├── upload_package/          ← デプロイ対象
│   ├── config/              # config.php (ROOT_DIR, DATA_DIR 定義)
│   ├── data/                # JSON データストレージ
│   ├── lang/                # 多言語ファイル (ja/en)
│   ├── libs/                # PHP ライブラリ群
│   ├── public_html/         # Web ドキュメントルート
│   │   ├── index.php        # フィード（ホーム）
│   │   ├── api/             # API エンドポイント
│   │   ├── assets/          # CSS / JS / 画像
│   │   └── components/      # UI コンポーネント
│   └── scripts/             # メンテナンススクリプト
├── tests/                   # PHPUnit テスト
├── docs/                    # 設計ドキュメント
├── .agent/                  # AI エージェント設定
│   ├── workflows/           # /deploy, /pre-release 等
│   └── skills/              # sitemap_navigator, oreshika_growth 等
└── .github/workflows/       # CI/CD (GitHub Actions)
```

## ローカル開発

```powershell
# PHP Built-in Server で起動
php -S localhost:8899 -t upload_package/public_html

# 構文チェック（全ファイル）
composer lint

# テスト実行
composer test
```

## デプロイ

SCP 経由で RS Plan へ同期。詳細は `.agent/workflows/deploy.md` 参照。

```powershell
# エージェント経由: /deploy ワークフローを実行
```

## AI エージェント ワークフロー

| コマンド | 用途 |
|---------|------|
| `/deploy` | 本番デプロイ（バックアップ → アップロード → 検証） |
| `/pre-release` | リリース前品質ゲート（lint + パス + ブラウザ + API） |
| `/quick-check` | 日常開発用の軽量チェック（30秒） |
| `/systematic-debug` | 構造化デバッグ（4フェーズ） |

## 現在のフェーズ

- ✅ Phase 13: SiteManager / GeoJSON / Dashboard / Editor
- ✅ Phase 14A: レポート MVP (RedListManager, BIS, TNFD LEAP)
- 🔲 Phase 14B: 投稿体験強化 (post.php, 同定ブリッジ)
