# Codex レビュー指示書: エリア3D生態系モデル機能

**日付**: 2026-03-19
**対象**: PR #9-#11 で構築したパッシブ観察 + フィールドスキャン + 3D生態系モデル機能
**目的**: この設計が「100年使えるプラットフォーム」として最善かを検証する。妥協は不要。

---

## あなたへの依頼

あなたは世界最高レベルのソフトウェアアーキテクト兼生態学テクノロジーの専門家として、以下のシステムを**徹底的に批評**してください。

「いいね」「よくできている」は不要です。**問題点、見落とし、もっと良い方法**だけを指摘してください。

---

## 現在のシステム概要

### コンセプト
スマートフォンで「フィールドスキャン」を起動して歩くだけで、エリアの3D生態系デジタルツインが自動構築される。

### センサー統合
| センサー | 用途 | 実装 |
|---|---|---|
| カメラ | 種の視覚検出 | Gemini API (サーバー) / Core ML (iOS) / TFLite (Android) |
| マイク | 鳥声・虫声の分類 | BirdNET Lite (TFLite) / ダミー (Web) |
| GPS | ルート・座標記録 | FusedLocation (Android) / CLLocation (iOS) / Geolocation API (Web) |
| LiDAR | 植生3Dメッシュ | ARKit (iPhone 13 Pro のみ) |
| 加速度 + 気圧 | 行動パターン・標高 | SensorManager (Android) / CoreMotion (iOS) |

### データモデル (EcosystemMapper.php)
```
Area → Session[] → Detection[]
                → Route[]
                → VegetationZone[]
                → EnvironmentSnapshot[]
```
- 同じエリアを繰り返しスキャン → データが蓄積
- 種は taxon_name で重複排除、sighting 配列に全観察を記録
- 3D GeoJSON で出力（Point + LineString + Polygon with altitude）
- Simpson 多様性指数でエリアスコア算出

### プラットフォーム戦略
| プラットフォーム | モード | 制約 |
|---|---|---|
| Web (field_scan.php) | カメラ + 音声 + GPS | タブ開いてる間のみ |
| iOS (FieldScanView) | 全センサー + LiDAR + ARKit | バックグラウンド制約あり |
| Android (PocketService) | 全センサー + バックグラウンド常時 | LiDAR なし |

### サーバー API
| エンドポイント | 役割 |
|---|---|
| POST /api/v2/ecosystem_map.php | スキャンデータ受信 → モデル更新 |
| GET /api/v2/ecosystem_map.php?format=geojson3d | 3D GeoJSON 取得 |
| GET /api/v2/ecosystem_map.php?action=timeline | 時系列データ |
| GET /api/v2/ecosystem_map.php?action=heatmap | 種分布ヒートマップ |
| POST /api/v2/passive_event.php | ポケットモード: バッチ受信 |
| POST /api/v2/scan_detection.php | スキャンモード: 写真付き受信 |
| POST /api/v2/ai_classify.php | リアルタイム AI 種同定 |

---

## レビュー項目（全項目に回答必須）

### 1. データモデルの致命的欠陥

現在のデータモデルは JSON ファイルベース（`data/ecosystem_maps/{areaId}.json`）。

**質問:**
- このモデルは100万ユーザー、100万エリアにスケールするか？
- 1エリアのデータが100MBを超えた場合にどうなるか？
- GeoJSON は3D生態系モデルの表現として適切か？ もっと良いフォーマットはないか？
- 時系列データの格納方法は最適か？ 時系列DBの方が良いか？
- 種の重複排除ロジック（taxon_name 文字列マッチ）は脆弱すぎないか？

### 2. 3Dモデルの限界

現在の「3D」は実際にはGeoJSON に高さ (altitude) を付けただけ。

**質問:**
- 真の3Dシーン表現（植物の形状、木の配置、地形の起伏）に何が必要か？
- LiDAR の点群データをサーバーに送るべきか、エッジで処理すべきか？
- 3D点群の標準フォーマット（LAS/LAZ、PLY、glTF）のどれが最適か？
- iPhone の LiDAR の精度（±1cm）は生態学的に有用か？
- WebGL / Three.js でブラウザ上の3D表示は現実的か？ パフォーマンスは？

### 3. AI推論アーキテクチャ

現在: Web版は毎回サーバーに写真を送信して Gemini で推論。ネイティブはオンデバイス。

**質問:**
- サーバー側 AI 推論のレイテンシ（4秒間隔 × ネットワーク往復）はUXとして許容範囲か？
- オンデバイス推論とサーバー推論のハイブリッド戦略は最適か？
- BirdNET Lite の精度は日本の鳥類に対して十分か？ 日本特化モデルは必要か？
- 植物の同定には画像だけでなく「葉の形状」「樹皮のテクスチャ」等のマルチモーダルが必要では？
- 昆虫の同定精度は現実的にどの程度か？ マクロ撮影なしで識別可能な種はどれだけあるか？

### 4. プライバシーとセキュリティ

**質問:**
- 音声録音の「推論後即破棄」ポリシーは法的に十分か？ GDPRやAPPI準拠は？
- GPS ルートデータは個人の行動パターンそのもの。匿名化は十分か？
- LiDAR の3Dメッシュに人の顔や車のナンバープレートが含まれるリスクは？
- 子供が使う場合のCOPPA準拠は考慮されているか？
- 希少種の詳細な位置データが攻撃者に悪用されるリスクの対策は？

### 5. UXの根本的な問い

**質問:**
- 「歩くだけで3Dモデルが構築される」は本当にユーザーが求めているものか？
- 一般ユーザー（非研究者）にとって3D生態系モデルの「使い道」は何か？
- ポケモンGO が成功したのは「コレクション + ゲーム性」。ikimon に足りないゲーム要素は？
- 「スキャンして楽しい」の持続性は？ 1ヶ月後も毎日使いたくなるか？
- 3Dモデルの構築よりも、「その場で生物について教えてくれるAR図鑑」の方が直感的では？
- 子供と大人でUIを分けるべきでは？

### 6. 既存プラットフォームとの差別化

**質問:**
- iNaturalist はカメラ→AI同定を既に実装している。ikimon.life の明確な差別化ポイントは何か？
- Merlin Bird ID は音声による鳥の同定を既に高精度で実装している。BirdNET で追いつけるか？
- Google Lens は汎用物体認識で種同定もできる。専用アプリの優位性は？
- eBird はパッシブ観察をチェックリスト形式で実装済み。ikimon のパッシブの優位性は？
- 3D生態系モデルは他のどのプラットフォームも持っていないが、それは「誰も必要としていないから」ではないか？

### 7. 技術的実現可能性

**質問:**
- PHP 8.2 共有サーバーで、リアルタイム AI 推論 API は持続可能か？ 同時100ユーザーで？
- JSON ファイルストレージで3D生態系モデルの蓄積は破綻しないか？
- BirdNET TFLite モデルのサイズ（~40MB）はモバイルアプリとして許容範囲か？
- iPhone の ARKit セッションのバッテリー消費は1時間のフィールドワークに耐えるか？
- Android Foreground Service の常時音声モニタリングは、ユーザーのバッテリーを殺さないか？

### 8. 抜けている機能・考慮

以下の観点で、現在の設計に**欠落しているもの**を列挙してください:

- オフライン動作（圏外の山林でのスキャン）
- マルチユーザー統合（同じエリアを複数人がスキャンした場合のマージ）
- データエクスポート（研究者が使える形式: DwC-A、GBIF、SHP）
- バージョニング（モデルの経年変化を追跡する仕組み）
- エラーリカバリ（スキャン中にアプリがクラッシュした場合のデータ復旧）
- アクセシビリティ（視覚障害者向けの音声ガイド対応）
- 国際化（日本以外の生態系への対応）
- 法規制（各国の環境データ収集に関する規制）

### 9. アーキテクチャの代替案

現在の構成に対して、以下の代替アーキテクチャを検討し、**どちらが優れているか根拠付きで判定**してください:

| 現在の設計 | 代替案 |
|---|---|
| PHP + JSON ファイル | Rust/Go + PostgreSQL + PostGIS |
| 各プラットフォーム個別開発 | Flutter / React Native クロスプラットフォーム |
| GeoJSON 3D | CesiumJS + 3D Tiles |
| BirdNET TFLite | Apple Sound Analysis API + CreateML |
| サーバー側 Gemini 推論 | エッジ推論のみ（サーバー不要） |
| EcosystemMapper (独自) | 既存の GIS エンジン（QGIS Server, GeoServer） |
| リアルタイムAPI | イベント駆動（Kafka/NATS + WebSocket） |

### 10. 最終判定

上記の全分析を踏まえて、以下に回答してください:

1. **この設計のまま進めるべきか？** Yes/No + 理由
2. **今すぐ変更すべき設計上の欠陥**（トップ3）
3. **6ヶ月以内に必ず対処すべき技術的負債**（トップ5）
4. **このプロジェクトが失敗するとしたら、最も可能性の高い原因は何か？**
5. **このプロジェクトが成功するために最も重要な1つの決断は何か？**

---

## 回答ルール

- 「よくできている」「素晴らしい」等のお世辞は一切不要
- 全ての指摘に**具体的な代替案**を添えること
- 「〜した方がいい」ではなく「〜すべき、理由は〜」の形式で
- 業界の先行事例やベンチマークがあれば引用すること
- 回答は日本語で

---

## 参照ファイル

レビュー対象のコードは以下のリポジトリにある:
- リポジトリ: `yamaki0102/ikimon-platform`
- ブランチ: `main` (PR #4-#11 マージ済み)

主要ファイル:
| ファイル | 役割 |
|---|---|
| `upload_package/libs/EcosystemMapper.php` | 3D生態系モデル構築エンジン |
| `upload_package/libs/PassiveObservationEngine.php` | パッシブ観察照合・判定 |
| `upload_package/public_html/api/v2/ecosystem_map.php` | エリアモデルAPI |
| `upload_package/public_html/api/v2/passive_event.php` | ポケットモード受信API |
| `upload_package/public_html/api/v2/scan_detection.php` | スキャンモード受信API |
| `upload_package/public_html/api/v2/ai_classify.php` | リアルタイムAI同定API |
| `upload_package/public_html/field_scan.php` | Web版フィールドスキャンUI |
| `mobile/ios/IkimonScan/Sources/Scan/FieldScanView.swift` | iOS統合スキャンUI |
| `mobile/ios/IkimonScan/Sources/Scan/FieldScanEngine.swift` | iOS全センサー統合エンジン |
| `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/pocket/PocketService.kt` | Android Foreground Service |
| `docs/strategy/mobile_ux_strategy.md` | UX戦略ドキュメント |
| `docs/strategy/refactoring_roadmap.md` | 全体改修ロードマップ |
