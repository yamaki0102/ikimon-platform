# Codex レビュー指示書: ikimon.life 3D生態系デジタルツイン

**日付**: 2026-03-19
**対象**: ikimon.life のパッシブ観察 + フィールドスキャン + 3D生態系モデル機能
**目的**: この設計が「100年使えるプラットフォーム」として最善かを徹底検証する

---

## あなたへの依頼

あなたは世界最高レベルのソフトウェアアーキテクト、かつ環境テクノロジー・リモートセンシング・市民科学プラットフォームの専門家として、以下のシステム設計を**徹底的に批評**してください。

**ルール:**
- 「よくできている」「素晴らしい」等のお世辞は一切不要。**問題点、見落とし、もっと良い方法**だけを出力せよ
- 全ての指摘に**具体的な代替案**を添えること
- 「〜した方がいい」ではなく「〜すべき。理由:〜」の形式で
- 業界の先行事例やベンチマークを引用すること
- 「妥協案」は不要。最善のみ提示せよ
- 回答は日本語で

---

## 1. プロジェクト概要

### ikimon.life とは
日本発の市民参加型生物多様性プラットフォーム。30by30 / TNFD LEAP 対応。
一般市民が日常の散歩で生態系データを蓄積し、100年分の環境変遷を記録する。

### ビジョン
「スマホとLiDARスキャナーで、エリアの生態系デジタルツインを構築する。歩くだけで、そのエリアにどんな生物がいて、季節ごとにどう変化し、100年後にどう変わったかが、3D空間として残る。」

### 現在のスタック
- **バックエンド**: PHP 8.2（お名前ドットコム共有サーバー）
- **フロントエンド**: Alpine.js + Tailwind CSS + MapLibre GL JS
- **データ**: JSON ファイルストレージ + SQLite (omoikane.sqlite3)
- **AI**: Gemini API (サーバー側) / Core ML (iOS) / TFLite (Android)
- **コードベース**: PHPライブラリ81ファイル、APIエンドポイント74個、Webページ72個

---

## 2. 利用可能なハードウェア

### 端末一覧

| デバイス | 役割 | ステータス |
|---|---|---|
| **3DMakerPro Eagle** (LiDARスキャナー) | 空間基盤構築（エリア丸ごとの3D点群） | 手元にある |
| **iPhone 13 Pro** | カメラ種検出 + 近距離LiDAR + ARKit | 手元にある |
| **Pixel 10 Pro** (Tensor G5) | バックグラウンド音声検出 + Gemini Nano | 3/24到着 |

### 3DMakerPro Eagle スペック（重要）

| 項目 | 値 |
|---|---|
| LiDAR | 905nm レーザー、Class 1 eye-safe |
| 点群周波数 | **200,000 pts/sec** |
| スキャン範囲 | **80〜140m** |
| 精度 | **2cm @10m / 3cm @20m / 5cm @40m** |
| 視野角 | 水平360° / 垂直59° |
| カメラ | 48MP × 4 (Max版)、360°×300° |
| パノラマ | **8K HDR** (3-5段階露出) |
| SLAM | 内蔵SLAM処理 |
| 出力フォーマット | **PLY (3D色付き点群) / OBJ (ポリゴン) / 3D Gaussian Splatting PLY / パノラマ OBJ** |
| 接続 | USB-C ×2、Wi-Fi 5 |
| ディスプレイ | 3.5インチ |
| プロセッサ | 8コア 2.4GHz、32GB RAM |
| バッテリー | 12,000mAh（1時間稼働、充電中使用可） |
| 重量 | 1.5kg |
| ソフトウェア | RayStudio（ノイズ除去・最適化）、クラウドGaussian Splatting処理 |

### iPhone 13 Pro スペック（補足）

| 項目 | 値 |
|---|---|
| チップ | A15 Bionic、Neural Engine 16コア |
| LiDAR | ±1cm精度、**数m範囲**（室内向け） |
| カメラ | 12MP × 3（広角、超広角、望遠） |
| ARKit | シーン再構成、平面検出、メッシュ生成 |
| 音声 | フォアグラウンドのみ（バックグラウンドは3分で停止） |

### Pixel 10 Pro スペック（補足）

| 項目 | 値 |
|---|---|
| チップ | Tensor G5、TPU |
| AI | **Gemini Nano** オンデバイス推論 |
| LiDAR | なし |
| 音声 | **Foreground Service でバックグラウンド常時録音可** |
| BirdNET | TFLite でオンデバイス鳥声分類 |

---

## 3. 現在の設計（レビュー対象）

### 3層アーキテクチャ

```
レイヤー1: 空間基盤（Eagle で構築、月1回程度）
  Eagle → 3D点群 (PLY, 200,000 pts/sec, 140m範囲)
        → 8K HDR パノラマ
        → 3D Gaussian Splatting
  = エリアの「物理的な3D空間」

レイヤー2: 生物レイヤー（スマホで日常的に蓄積）
  iPhone → カメラで種を視覚検出 (Core ML / Gemini API)
  Pixel  → 音声で鳥声・虫声を検出 (BirdNET / Gemini Nano)
  両方   → GPS座標 → Eagle の3D空間にマッピング
  = 空間の上に「生物の位置」を打つ

レイヤー3: 時間レイヤー（自動蓄積）
  繰り返しスキャン → 季節変動（3月: ウグイス → 8月: セミ）
  年単位 → 経年変化（環境変動、開発の影響）
  = 100年分の生態系変遷
```

### サーバー側エンジン

**EcosystemMapper.php**:
- 全センサーデータ統合（GPS + カメラ + 音声 + LiDAR + 環境）
- エリアモデル: Area → Session[] → Detection[] + Route[] + VegetationZone[]
- 3D GeoJSON 出力（Point + LineString + Polygon with altitude）
- Simpson 多様性指数でスコア算出
- 同じエリアを繰り返しスキャン → 蓄積マージ
- JSON ファイルベース (`data/ecosystem_maps/{areaId}.json`)

**PassiveObservationEngine.php**:
- 検出イベントの信頼度判定（70%自動記録 / 50%提案 / 30%破棄）
- 環境コンテキスト補正（OmoikaneDB から季節・生息地照合）
- 同一種の重複排除、セッションサマリー生成

**KnowledgeAutoReviewer.php**:
- 学術論文からのAI蒸留知識を自動承認/アラート
- 減点方式の信頼度スコア（閾値0.6）

### API エンドポイント

| エンドポイント | 役割 |
|---|---|
| POST /api/v2/ecosystem_map.php | スキャンデータ受信 → モデル更新 |
| GET /api/v2/ecosystem_map.php?format=geojson3d | 3D GeoJSON 取得 |
| GET /api/v2/ecosystem_map.php?action=timeline | 時系列データ |
| GET /api/v2/ecosystem_map.php?action=heatmap | 種分布ヒートマップ |
| POST /api/v2/passive_event.php | ポケットモード: バッチ受信 (max 500件) |
| POST /api/v2/scan_detection.php | スキャンモード: 写真付き受信 (max 100件) |
| POST /api/v2/ai_classify.php | リアルタイム AI 種同定 |
| GET /api/v2/observations.php | 観察データ取得 (フィルタ/ステージ/BBox) |
| POST /api/v2/stage_transition.php | 検証ステージ手動遷移 |
| GET /api/v2/search.php | 観察・種・文献 横断検索 |
| GET /api/v2/identifier_queue.php | 同定者スマートキュー |

### プラットフォーム戦略

| プラットフォーム | 実装 | 役割 |
|---|---|---|
| Web (field_scan.php) | Alpine.js + MapLibre GL | カメラ+音声+GPS（画面ON中） |
| iOS (FieldScanView) | Swift/SwiftUI + ARKit + Vision | 全センサー + LiDAR + AR |
| Android (PocketService) | Kotlin/Compose + TFLite | バックグラウンド音声常時 |
| Eagle (外部デバイス) | RayStudio → PLY/OBJ export | 空間基盤の3D点群 |

### データステージ管理 (DataStageManager.php)

```
unverified → ai_classified → human_verified → research_grade
              ↘ needs_review ↗
```
- 全遷移を監査ログに記録
- BISスコアに検証ステージの重みを反映

---

## 4. レビュー項目（全項目に回答必須）

### 4.1 3層アーキテクチャの妥当性

Eagle（空間基盤）+ スマホ（生物レイヤー）+ 時間軸（蓄積）の3層設計について:

**質問:**
- この3層分離は正しいか？ 統合した方が良い層はあるか？
- Eagle のスキャン頻度（月1回想定）は適切か？ 植生は季節で変わるが、地形は変わらない。最適なスキャン頻度は？
- Eagle の PLY 点群（数GB/スキャン）と、スマホの GPS 座標（±5m）のマッチング方法は？ 座標系の統合にどういう技術が必要か？
- 3D Gaussian Splatting はこのユースケースに最適か？ NeRF、Photogrammetry、従来のメッシュモデルとの比較は？
- Eagle が捉える「空間」とスマホが捉える「生物」のタイムスタンプのズレ（Eagle は月1回、スマホは毎日）は問題にならないか？

### 4.2 Eagle 点群データのパイプライン

Eagle → サーバー → ユーザー閲覧 のデータフロー:

**質問:**
- PLY ファイル（数GB）のアップロードは共有サーバーで実現可能か？ ファイルサイズ制限は？
- 点群から「ゾーン」（canopy/understory/ground/water）への自動分類に必要なアルゴリズムは？ 既存ライブラリ（Open3D, PCL, PDAL）のどれが最適か？
- 3D Gaussian Splatting のレンダリングをブラウザで行うのは現実的か？ WebGL の性能限界は？ 必要な GPU スペックは？
- Eagle の RayStudio で処理した結果と、サーバー側の EcosystemMapper の責務分担はどうあるべきか？
- 点群データのバージョニング（季節ごとの差分管理）の最適な方法は？ Git LFS？ 独自の差分フォーマット？

### 4.3 デバイス間データ統合

iPhone（カメラ+LiDAR）+ Pixel（音声+GPS）+ Eagle（3D点群）のデータ統合:

**質問:**
- 3つの異なるデバイスの座標系を統合する最適な方法は？ Eagle の SLAM 座標、iPhone の ARKit ワールド座標、Pixel の GPS 座標は全く別物。どう合わせるべきか？
- iPhone の近距離 LiDAR（数m）と Eagle の遠距離 LiDAR（140m）の点群をマージする方法は？ ICP (Iterative Closest Point) か？
- 音声検出（Pixel）の位置特定精度は GPS 依存（±5m）。Eagle の点群（±2cm）の空間にマッピングする際の「不確実性」をどう表現すべきか？
- 3デバイスのデータを1つのエリアモデルに統合する際、コンフリクト解決ルール（同じ種を iPhone と Pixel が別の位置で検出した場合等）は？

### 4.4 データモデルとスケーラビリティ

**質問:**
- JSON ファイルベースの EcosystemMapper は、1エリアに1年分のスキャンデータ（Eagle 12回 + スマホ365日分）が蓄積した場合、何MBになるか？ 破綻しないか？
- 100万ユーザー × 各10エリアのスケールで、JSON ファイルストレージは持つか？
- GeoJSON は3D点群+生物ポイント+時系列の表現として適切か？ 代替: GeoParquet、CityGML、LandXML、3D Tiles？
- 時系列データの格納: 現在の sightings 配列 vs TimescaleDB / InfluxDB / DuckDB？
- 種の識別子: taxon_name 文字列ではなく GBIF backbone ID を使うべきでは？

### 4.5 AI 推論パイプライン

**質問:**
- サーバー側 Gemini 推論 (4秒間隔 × ネットワーク往復) のレイテンシは UX として破綻しないか？
- Eagle の 8K HDR パノラマ画像を AI に投入して「パノラマ全体から種を一括検出」する方法は？ 通常のオブジェクト検出モデルはパノラマに対応していない
- BirdNET Lite は日本の鳥類（約630種）に十分な精度を持つか？ 日本特化 fine-tuning は必要か？
- 植物同定: Eagle の 3D 点群から「木の樹形」を認識して種を推定する可能性は？
- 昆虫: マクロ撮影なしで同定できる種の割合は？ 「チョウ目」レベルが限界では？

### 4.6 プライバシーとセキュリティ

**質問:**
- Eagle の 8K HDR パノラマに人の顔・車のナンバーが写る確率は？ 自動ぼかし処理は必須か？
- 3D Gaussian Splatting で人の3Dモデルが再構成されるリスクは？
- GPS ルート + 3D空間 = ユーザーの自宅・通勤経路が特定される。匿名化は？
- APPI（個人情報保護法）、GDPR、COPPA の3法域でのコンプライアンスチェック
- 希少種の 3D 空間内の正確な位置（「あの木の枝」レベル）が漏洩した場合の影響は？

### 4.7 UX の根本的な問い

**質問:**
- 「Eagle で月1回スキャン → スマホで毎日データ追加」のワークフローは、一般ユーザーに求めるには重すぎるのでは？
- Eagle は 1.5kg + 1時間バッテリー。フィールドワーク（山林、湿地）での実用性は？
- 3D Gaussian Splatting の閲覧体験は「すごい」が、日常的に繰り返し見るものか？
- ポケモンGO のゲーム性、iNaturalist のコミュニティ性、eBird のチェックリスト文化。ikimon のキラーフックは何か？
- 「3Dモデルを構築する喜び」vs「今目の前の鳥の名前を知る喜び」— ユーザーの本当の動機は後者では？
- 子供向け UX として、3D空間は複雑すぎないか？ 「図鑑にスタンプを集める」方が直感的では？

### 4.8 既存プラットフォーム・技術との比較

**質問:**
- iNaturalist (カメラ→AI同定、コミュニティ同定) との差別化ポイントは？
- Merlin Bird ID (音声鳥同定) に BirdNET で勝てるか？
- Polycam / Matterport (3D空間スキャン) のエコシステム版として成立するか？
- Cesium / Google Earth Engine (地理空間プラットフォーム) との統合 vs 競合？
- GBIF / eBird のデータ標準との互換性は十分か？
- Gaussian Splatting の先行プロジェクト（Luma AI、Polycam）の教訓は？

### 4.9 抜けている機能・考慮

以下の各観点で、現在の設計に**欠落しているもの**を具体的に列挙せよ:

- Eagle の点群 → サーバーへのアップロードパイプライン（チャンクアップロード、圧縮、進捗表示）
- オフライン動作（圏外の山林でのスキャン、オフライン同定モデル）
- マルチユーザー統合（同じエリアを複数人がスキャン、iPhone と Pixel と Eagle のデータマージ）
- データエクスポート（DwC-A、GBIF IPT、Shapefile、GeoPackage、3D Tiles）
- 点群の差分更新（毎月の Eagle スキャンの差分だけを保存する仕組み）
- エラーリカバリ（スキャン中のクラッシュ、アップロード中断の復旧）
- アクセシビリティ（視覚障害者向け音声ガイド、色覚多様性対応）
- 国際化（日本以外の生態系への対応、多言語 taxon 名）
- 法規制（環境データ収集の各国規制、ドローン規制との関係）
- Eagle のハードウェア故障時のフォールバック（スマホだけでの degraded mode）

### 4.10 アーキテクチャの代替案

現在の構成に対して、以下の代替を**根拠付きで比較判定**せよ:

| 現在の設計 | 代替案A | 代替案B |
|---|---|---|
| PHP + JSON ファイル | Rust + PostgreSQL + PostGIS | Go + DuckDB + Parquet |
| 各プラットフォーム個別開発 | Flutter 統一 | React Native + Expo |
| GeoJSON 3D | Cesium 3D Tiles | Potree (WebGL point cloud) |
| BirdNET TFLite | Apple Sound Analysis + CreateML | Gemini Nano Audio |
| サーバー側 Gemini 推論 | エッジ推論のみ | ハイブリッド（エッジ初回→サーバー検証） |
| EcosystemMapper (独自JSON) | QGIS Server / GeoServer | PostGIS + pg_pointcloud |
| 3D Gaussian Splatting (PLY) | Three.js + glTF | Cesium ion + 3D Tiles |
| リアルタイムAPI (HTTP) | WebSocket + NATS | gRPC ストリーミング |
| Eagle PLY → JSON変換 | LAZ/LAS → COPC (Cloud Optimized Point Cloud) | E57 → Potree octree |

### 4.11 最終判定

上記の全分析を踏まえ、以下に**明確に回答**せよ:

1. **Eagle + iPhone + Pixel の3デバイス戦略は最善か？** もっと良い組み合わせはあるか？
2. **3層分離（空間基盤 / 生物レイヤー / 時間レイヤー）は正しいか？** 根本的に変えるべき構造はあるか？
3. **今すぐ変更すべき設計上の欠陥**（トップ3、具体的なコード変更指示付き）
4. **6ヶ月以内に必ず対処すべき技術的負債**（トップ5）
5. **このプロジェクトが失敗するとしたら、最も可能性の高い原因は何か？**
6. **このプロジェクトが iNaturalist を超えるために、最も重要な1つの決断は何か？**
7. **3D Gaussian Splatting + 生態系データ のコンセプトが世界初なら、研究論文として発表すべきか？ どのジャーナルが適切か？**

---

## 5. 参照ファイル

レビュー対象のコード:
- リポジトリ: `yamaki0102/ikimon-platform`
- ブランチ: `main` (PR #4-#11 マージ済み)

| ファイル | 役割 |
|---|---|
| `upload_package/libs/EcosystemMapper.php` | 3D生態系モデル構築エンジン |
| `upload_package/libs/PassiveObservationEngine.php` | パッシブ観察照合・判定 |
| `upload_package/libs/KnowledgeAutoReviewer.php` | 蒸留知識自動承認 |
| `upload_package/libs/DataStageManager.php` | 検証ステージ管理 |
| `upload_package/libs/LiteratureIngestionPipeline.php` | 論文取込パイプライン |
| `upload_package/libs/IdentifierQueue.php` | 同定者スマートキュー |
| `upload_package/public_html/api/v2/ecosystem_map.php` | エリアモデルAPI |
| `upload_package/public_html/api/v2/passive_event.php` | ポケットモード受信API |
| `upload_package/public_html/api/v2/scan_detection.php` | スキャンモード受信API |
| `upload_package/public_html/api/v2/ai_classify.php` | リアルタイムAI同定API |
| `upload_package/public_html/api/v2/observations.php` | 統合観察API |
| `upload_package/public_html/api/v2/search.php` | 横断検索API |
| `upload_package/public_html/field_scan.php` | Web版フィールドスキャンUI |
| `upload_package/public_html/scan.php` | Web版スキャンモード |
| `upload_package/public_html/walk.php` | Web版ウォークモード |
| `mobile/ios/IkimonScan/Sources/Scan/FieldScanView.swift` | iOS統合スキャンUI |
| `mobile/ios/IkimonScan/Sources/Scan/FieldScanEngine.swift` | iOS全センサー統合エンジン |
| `mobile/ios/IkimonScan/Sources/Scan/CameraManager.swift` | iOSカメラ管理 |
| `mobile/ios/IkimonScan/Sources/Detection/SpeciesDetector.swift` | iOS種検出パイプライン |
| `mobile/ios/IkimonScan/Sources/API/IkimonAPIClient.swift` | iOSサーバー通信 |
| `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/pocket/PocketService.kt` | Android Foreground Service |
| `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/pocket/AudioClassifier.kt` | Android BirdNET推論 |
| `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/pocket/LocationTracker.kt` | Android GPS追跡 |
| `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/data/EventBuffer.kt` | Androidイベントバッファ |
| `docs/strategy/mobile_ux_strategy.md` | UX戦略ドキュメント |
| `docs/strategy/refactoring_roadmap.md` | 全体改修ロードマップ（Phase 2-7） |

---

## 6. 追加コンテキスト

### テスト現況
- 128テスト、278アサーション、全パス
- DataStageManager / KnowledgeAutoReviewer / DataQuality / BiodiversityScorer / PrivacyFilter / PassiveObservationEngine のユニットテスト

### 論文パイプライン
- CrossRef + J-STAGE + CiNii → 統合検索 → PaperStore (JSON) + OmoikaneDB (SQLite) デュアルライト
- Gemini 2.5 Flash で論文から生態制約・同定キーを蒸留 → 自動承認 or アラート

### 既存ユーザー向け機能（ikimon.life 本体）
- 観察投稿 (post.php)、同定センター (id_center.php)、探索 (explore.php)
- サイトダッシュボード、企業ポートフォリオ、TNFD LEAPレポート
- BIS スコア（5軸モデル）、PrivacyFilter（3層プライバシー）
- ゲーミフィケーション、バッジ、ランキング
