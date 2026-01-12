# 【完全版】自然共生プラットフォーム システム要件定義書 (MECE)

**プロジェクト名**: ikimon 市民参加型生物観察サービス プロトタイプ
**対象インフラ**: お名前.com RSプラン (レンタルサーバー)
**作成者**: Antigravity (World's Strongest Engineer & UI/UX Designer)
**バージョン**: 1.0.0

---

## 1. プロジェクト定義 (Project Definition)
### 1.1 目的 (Purpose)
- **Core Mission**: 「生物多様性の見える化」から「具体的な保全行動（Action）」への転換。
- **Outcome**:
    - [ ] 自然共生サイト（OECM）の認知拡大・理解促進
    - [ ] 支援者とサイトのマッチング成立
    - [ ] 自治体の30by30目標達成支援
    - [ ] 研究・分析用データのオープン化促進

### 1.2 スコープ (Scope)
- **In-Scope**:
    - 一般公開フロントエンド（PC/SPレスポンシブ）
    - 自然共生サイト（サイト詳細）ページ群
    - 生物多様性マップ（WebGIS プロトタイプ）
    - 各種コンタクト・支援マッチング導線
    - 静的データ（JSON）によるコンテンツ管理構造
- **Out-of-Scope (for Prototype)**:
    - リアルタイムDB書き込み（ユーザー登録、動的投稿機能はGoogleフォーム等で代替）
    - 複雑な空間解析（GISサーバー処理は持たず、クライアントサイド描画または静的生成のみ）
    - 決済機能

---

## 2. ユーザー体験要件 (User Experience Requirements)
ユーザーの「迷子」を防ぐため、体験モードを**MECE（漏れなく・重複なく）**に分割する。

### 2.1 体験モード (Experience Modes)
1.  **探索モード (For General Users)**
    - **Goal**: 身近な自然・面白い生物を発見し、親しみを持つ。
    - **Requirements**:
        - 直感的なカード型UI（「地図」をいきなり見せない）。
        - ストーリーテリング（成功事例の紹介）。
        - モバイル最適化（Gate T基準準拠）。
2.  **支援モード (For Supporters/Companies)**
    - **Goal**: 支援すべきサイトを見つけ、資源（金・人・モノ）を提供する。
    - **Requirements**:
        - 「支援募集」フィルタリング機能。
        - 案件詳細 → 問い合わせへの最短導線（3クリック以内）。
        - 企業のCSR担当者に響く「価値」の可視化。
3.  **申請モード (For Landowners/Applicants)**
    - **Goal**: 所有地が認定されるか確認し、申請準備を進める。
    - **Requirements**:
        - 自分の土地の価値（1〜9基準）診断ナビ。
        - 申請に必要なエビデンス・書類のガイド。
4.  **分析モード (For Municipalities/Researchers)**
    - **Goal**: 地域の保全状況を把握し、データを活用する。
    - **Requirements**:
        - 自治体別ダッシュボード（目標 vs 現状）。
        - データカタログとダウンロード（オープンデータ）。
5.  **専門家モード (For Identification Experts)**
    - **Goal**: 未同定の生物名を確定させ、データ品質を「Research Grade」に引き上げる。
    - **Requirements**:
        - **同定センター (ID Center)**: エリア・分類・状態で高速フィルタリングできる「千本ノック」UI。
        - **合意形成システム**: 複数の専門家による「同定同意」でデータ品質を担保する仕組み。
        - **貢献の可視化**: 同定数・正答率・貢献ランキングによるゲーミフィケーション（ボランティア維持）。
        - **1秒判定UI (H025)**: 「確認済/保留/回答」を瞬間的に捌ける千本ノックUI。
        - **博士認定 (H029)**: 特定分野（例：クモ）の貢献者に「博士」バッジを与え、モチベーションを高める。

### 2.1 Winning Strategy & Differentiation (Anti-Biome)
**「Biomeのパクリ」と言われないための明確な差別化**:
- **Human Connection vs Auto Collection**:
    - Biomeは「AIで集めるゲーム」。ikimonは「人と繋がるコミュニティ」。
    - AIによる自動判定を*あえて*排除し、人（専門家）との対話を価値の中心に置く。
- **Local Infrastructure vs National Game**:
    - 全国一律ではなく「浜松」などの特定地域に特化し、リアルの場（公園・看板）と深く連携する。
    - 単なる遊びではなく、「OECM認定」「地域ポイント」など実社会のインフラとして機能させる。
- **Value Exchange vs Just Points**:
    - ポイント等のデジタル資産ではなく、**「生物多様性クレジット」という金融的価値**への転換を見据える。

### 2.2 Hypothesis-Driven Features
競合分析から導き出された、ikimon独自の勝ち筋:
- **知的好奇心の充足 (H001)**: 「科学貢献」より「名前を知りたい」欲求を最優先し、24時間以内のリアクションを保証する。
- **局所目標の共有 (H019)**: 「100万種」より「浜松市であと1種」のような、自分ごと化できる目標を提示する。
- **所有感の醸成 (H006/H012)**: 自分の投稿が地図を埋めていく「陣取り」感覚と、図鑑が埋まる「コレクション」要素を重視。
- **O2O導線 (H088)**: 公園の看板QRからインストール不要（PWA）で即投稿できる「起動即撮影」体験。


---

## 3. 機能要件 (Functional Requirements)
システムが実装すべき機能を網羅する。

### 3.1 フロントエンド機能 (Frontend)
- **地図機能 (Map Interface)**
    - [ ] **ベースマップ**: 地理院地図 / OpenStreetMap。
    - [ ] **レイヤー制御**:
        - 行政界
        - 自然共生サイト位置（ポイント/ポリゴン）
        - 保護地域（国立公園等）
    - [ ] **インタラクション**:
        - クリックで詳細ポップアップ（CTA含む）。
        - 縮尺に応じた情報の出し分け（間引き）。
- **サイト詳細ページ (Site Detail)**
    - [ ] **基本情報**: 名称、場所、概要、写真。
    - [ ] **価値認定**: 認定基準（1〜9）のアイコン表示。
    - [ ] **活動ログ**: ブログ形式の活動報告（写真＋テキスト）。
    - [ ] **支援情報**: 「求む！草刈りボランティア」「求む！調査機材」等の募集カード。
- **検索・ナビゲーション**
    - [ ] **統合検索**: 住所、キーワード、生物名での横断検索。
    - [ ] **用語辞典**: オーバーレイによる用語解説（OECM、30by30等）。

### 3.2 専門家・品質管理機能 (Specialist & QA)
- **同定センター (Identification Center)**
    - [ ] **高速同定UI**: 「確認済」「保留」「回答」をワンクリックで処理するカード型UI。
    - [ ] **品質ステータス管理**:
        - Needs ID (同定求む)
        - Identification Agreed (合意形成済)
        - Research Grade (研究グレード：複数人の合意＋高精度位置情報)
- **生物多様性評価 (Scoring Logic)** (Beta)
    - [ ] **Biodiversity Score**: 種多様性(Shannon-Wiener)、保全重要種確認数、観察努力カバレッジから算出する参考スコア。
    - [ ] **外来種アラート**: 特定外来生物の観測をダッシュボードで警告。

- **生物多様性評価 (Scoring Logic)** (Beta)
    - [ ] **Biodiversity Score**: 種多様性(Shannon-Wiener)、保全重要種確認数、観察努力カバレッジから算出する参考スコア。
    - [ ] **外来種アラート**: 特定外来生物の観測をダッシュボードで警告。

### 3.3 AI活用方針 (AI Policy)
**重要**: 初期フェーズでは「AIによる種同定」は**実装しない**（学習データ不足による誤同定防止のため）。
- **AIの役割**: 入力補助・ユーザビリティ向上に限定する。
    - [ ] **入力サポート**: 写真からのメタデータ（日時・位置）自動抽出、明るさ・鮮明さの自動判定。
    - [ ] **粗分類アシスト**: 「植物」「昆虫」「鳥」程度の大きな分類の自動タグ付け（誤同定リスクが低い範囲）。
    - [ ] **類似画像検索**: 同定ではなく「似ている画像をデータベースから探す」検索補助としての活用は要検討。

### 3.4 データ管理機能 (Data Management)
RSプラン（静的・ハイブリッド構成）に最適化した設計。
- **コンテンツ管理**:
    - `data/sites.json`: サイト基本情報。
    - `data/news.json`: お知らせ・活動ログ。
    - `data/layers/*.geojson`: 地図用ベクタデータ。
- **問い合わせ管理**:
    - PHPMailerによるメール送信機能（SMTP認証）。
    - reCAPTCHA v3 によるスパム対策。

---

## 4. 非機能要件 (Non-Functional Requirements)
### 4.1 インフラ・環境 (Infrastructure)
- **Server**: **お名前.com RSプラン**
    - **OS**: Linux (CentOS/AlmaLinux等)
    - **Web Server**: Apache (またはNginx reverse proxy + Apache)
    - **Language**: PHP 8.2 (推奨) / 8.1
    - **WAF**: 標準搭載WAFの挙動確認（誤検知時の除外設定）
- **Constraints**:
    - SSH接続可（デプロイ自動化に利用可能）。
    - `.htaccess` 利用可（URLリライト、キャッシュ設定）。
    - データベース容量・接続数制限（今回はJSON運用により回避）。

### 4.2 パフォーマンス (Performance)
- **LCP (Largest Contentful Paint)**: 2.5秒以内。
- **CLS (Cumulative Layout Shift)**: 0.1未満（地図読み込み時のガタつき防止）。
- **画像最適化**: 全てWebP形式で配信、遅延読み込み（lazy loading）適用。

### 4.3 UI/UX・デザイン (Design Quality)
- **Design Code**: "Designed Imperfection" (2026 Trend) + "Nature Positive"
- **Mobile First**:
    - **Gate T (Text Area Gate)** 準拠：スマホ(375px)でのテキスト実効幅確保。
    - 地図はスマホでは「固定比率の埋め込み」とし、全画面地図による操作不能（スクロールジャック）を防ぐ。
- **Animation**:
    - GSAPによる「有機的な波形」「生き物の浮遊」演出。
    - 待たせない（UXを阻害しない）マイクロインタラクション。

### 4.4 セキュリティ (Security)
- **通信**: 常時SSL (Let's Encrypt / お名前.com標準SSL)。
- **フォーム**:
    - CSRFトークン必須。
    - 入力値バリデーション・エスケープ処理（XSS対策）。
- **秘匿情報**:
    - 希少種の正確な位置情報はGeoJSONに含めない（グリッド化または非公開）。

---

## 5. ディレクトリ・ファイル構成案 (Structure)
お名前.com RSプランの `/public_html` 配下を想定。

```text
/public_html
├── .htaccess               # URLリライト、セキュリティヘッダ、キャッシュ設定
├── index.php               # トップページ（モード分岐）
├── map.php                 # 地図ページ
├── sites.php               # サイト一覧・検索
├── site_detail.php         # サイト詳細（?id=xxx）
├── about.php               # プロジェクト概要・用語集
├── contact.php             # 問い合わせフォーム
│
├── assets/
│   ├── css/                # Tailwind (style.css)
│   ├── js/                 # Alpine.js, GSAP, MapLibre GL JS
│   ├── img/                # WebP画像
│   └── fonts/
│
├── components/             # PHP共通パーツ
│   ├── header.php
│   ├── footer.php
│   ├── card_site.php
│   └── nav_mode.php
│
├── api/                    # 簡易API（必要な場合）
│
└── data/                   # JSONデータストア
    ├── sites.json          # サイトマスター
    ├── support_needs.json  # 支援募集データ
    └── layers/             # GeoJSONファイル群
```

---

## 6. 実装フェーズ (Implementation Roadmap)
1.  **Phase 1: Foundation Setup**
    - お名前.com RSサーバー設定（PHP, SSL, WAF確認）。
    - ベースHTML/CSSコーディング（Tailwind設定）。
2.  **Phase 2: Core UX (Modes & Detail)**
    - トップページ（モード選択）。
    - サイト詳細テンプレート実装。
3.  **Phase 3: Map Integration**
    - MapLibre GL JS 導入。
    - サンプルGeoJSONの表示。
4.  **Phase 4: Optimization**
    - スマホ実機検証（Gate T）。
    - パフォーマンスチューニング。
