# ikimon.life - 市民参加型生物観察プラットフォーム

## 概要

ikimonは「地域の自然インフラ」をコンセプトとした、市民参加型の生物観察プラットフォームです。
30by30（2030年までに陸海30%保全）に貢献するデータ収集と、ユーザーの自己効力感を高める設計を両立しています。

---

## プロジェクト構造

```
ikimon/
├── ikimon.life/              # 仕様・設計書
│   ├── 要件/specs/           # ★ 仕様書格納場所
│   │   ├── ikimon_service_design_v3_final.md  # サービス設計書（メイン）
│   │   ├── data_standards.md                  # Darwin Core準拠データ標準
│   │   ├── data_impact_tracking.md            # データ活用追跡仕様
│   │   ├── impact_area_map.md                 # Impactページ仕様
│   │   ├── gamification_and_alerts.md         # ゲーミフィケーション
│   │   └── ...
│   └── readme/               # 開発ガイド
│
├── deploy/ikimon.life/       # デプロイ用ファイル（フラット構成）
│   ├── index.php             # ホーム（フィード）
│   ├── impact.php            # Impactページ（エリアマップ）
│   ├── profile.php           # プロフィール
│   ├── components/           # 共通コンポーネント
│   ├── libs/                 # バックエンドライブラリ
│   ├── config/               # 設定ファイル
│   ├── data/                 # JSONデータストレージ
│   └── start_server.ps1      # ローカルサーバー起動
│
└── ikimonofficial/           # 公式サイト・デモ
    └── demosite/             # 企業向けデモページ
```

---

## ローカル開発

### サーバー起動
```powershell
cd deploy/ikimon.life
.\start_server.ps1
# → http://localhost:8080 でアクセス
```

### 技術スタック
- **Backend**: PHP 8.2
- **Frontend**: Tailwind CSS + Alpine.js
- **Icons**: Lucide Icons
- **Map**: MapLibre GL JS + 地理院タイル

---

## 主要仕様書

すべての仕様書は `ikimon.life/要件/specs/` に格納されています。

| ファイル | 内容 |
|---------|------|
| `ikimon_service_design_v3_final.md` | サービス設計のマスタードキュメント (518行) |
| `data_standards.md` | Darwin Core準拠、GBIF/OECM連携 |
| `data_impact_tracking.md` | データ活用追跡（GBIF, 自然共生サイト, 論文） |
| `impact_area_map.md` | Impactページ（エリアマップ、Top10%貢献者） |
| `gamification_and_alerts.md` | ゲーミフィケーション設計 |
| `identification_logic.md` | 同定ロジック |

---

## 最新の実装状況 (2026/01/11)

### ✅ 完了
- デプロイ構成最適化 (Flat Structure v1)
  - `public_html` を廃止し、ルートからの相対パスに統一
  - レンタルサーバーへのデプロイ親和性を向上
- モバイルヘッダー刷新 (Universal Header v2)
  - **右サイド・ドロワー** 構成（片手操作性を向上）
  - **アカウント統合**: ログイン/プロフィールをドロワー上部に集約
  - **コンテキスト対応**: モード切替（デフォルト/インパクト/同定）
- PWA & Pwa-Ready 音響制御
  - 初回タップまで AudioContext 起動を待機する改善
  - PWA用プレミアムアイコン生成・導入
- Impact ページ v2 (Ingress風エリアマップ)
  - 全人類 vs 空白エリア コンセプト
  - 自動生成ミッション（カバレッジ最低エリア）
  - 市区町村カバレッジダッシュボード
  - Top 10% 貢献者（観察/同定部門）

### 🔄 進行中
- プロフィールページに「データ活用履歴」追加
- 企業向けダッシュボードに活用実績表示

---

## コンタクト

IKIMON株式会社 × Antigravity
