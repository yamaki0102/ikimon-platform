# FieldScan + ikimon.life 100年アーカイブ戦略 — 実装計画

## Context

「2026年に記録しなかったデータは二度と取り戻せない」

これが ikimon.life の哲学。FieldScan は「最強のアプリ」ではなく「最も多くの環境タイムカプセルを生成する装置」。ikimon.life はそれを受け止め、100年残し、社会に返す基盤。

Codex レビュー + 戦略文書 (`fieldscan_ikimon_100y_archive_strategy_2026-03-24.md`) を踏まえ、**既存実装とのギャップ**を埋める具体的改修計画を立てる。

---

## 既存実装の棚卸し（思った以上に土台がある）

### すでに揃っているもの

| 機能 | 実装 | 状態 |
|------|------|------|
| 6層 Canonical Schema | `CanonicalStore.php` | ✅ Event/Occurrence/Evidence/ID/Privacy/LiveDetection |
| Evidence Tier (1-3+) | `EvidenceTierPromoter.php` | ✅ 自動昇格ロジック |
| DarwinCore/GBIF エクスポート | `DwcExportAdapter.php` | ✅ 23フィールドCSV + meta.xml + eml.xml |
| GBIF公開API | `gbif_publish.php` | ✅ UAT/本番対応モック |
| PassiveObservation 受信 | `passive_event.php` | ✅ audio/visual/sensor バッチ受付 |
| 環境ログ保存 | `passive_event.php` L307-323 | ✅ `environment_logs` コレクション |
| MRI（モニタリング参照指数） | `MonitoringReferenceScorer.php` | ✅ Shannon-Wiener, 5軸スコア |
| セッションレキャップ | `session_recap.php` | ✅ 9パターン貢献認識 + AI要約 |
| タイムカプセル（去年の今頃） | `get_time_capsule.php` | ✅ 1年前の観察を表示 |
| Observer Rank Score | `ObserverRank.php` | ✅ 3軸（記録/同定/フィールド） |
| 100年耐久設計原則 | `adr-002-century-durability.md` | ✅ 文書化済み |
| ベクトル検索基盤 | `EmbeddingStore.php` | ✅ 768次元, SQLite |

### ギャップ（戦略に対して不足しているもの）

| ギャップ | 重要度 | 理由 |
|---------|--------|------|
| **環境センサーデータの構造化スキーマ** | 🔴高 | `env_history` が未定義JSON。100年データには構造が必須 |
| **「あなたの貢献」の社会的可視化** | 🔴高 | TNFD採用・GBIF提供数・引用数がプロフィールにない |
| **100年アーカイブのブランディングUI** | 🟡中 | ADR-002は書いたが、ユーザー向け説明がない |
| **iNaturalist インポート** | 🟡中 | 「接続」の導線がゼロ |
| **音声データの長期保存戦略** | 🟡中 | ハッシュのみ保存。生WAVの保存方針なし |
| **FieldScan → ikimon.life の同期** | 🔴高 | `SYNC_ENABLED = false` のまま |
| **FieldScan の種レベル同定** | 🔴高 | Gemini Nano が科レベル止まり |
| **FieldScan のオフライン音声同定** | 🟡中 | 現行 AudioScanner がサーバー依存 → BirdNET V3 (ONNX) + Perch v2 (TFLite) デュアル構成で解決 |

---

## 改修計画

### Phase 1: FieldScan 基盤修正（データを流す）

**目標**: タイムカプセルの価値の根幹を作り、ikimon.life にデータを流す

#### 1-1. TFLite 種同定モデル導入
- **ファイル**: `ikimon-fieldscan/app/src/main/java/life/ikimon/fieldscan/ai/TFLiteEngine.kt`（新規）
- **内容**: iNaturalist/GBIF 学習済み TFLite モデルで種レベル推論
- **Nano との分業**: Nano は環境分析専任、TFLite が種同定担当
- **変更**: `GeminiNanoEngine.kt` のプロンプトを環境分析用に書き換え

#### 1-2. Detection データモデル拡張
- **ファイル**: `ikimon-fieldscan/app/src/main/java/life/ikimon/fieldscan/data/Detection.kt`
- **追加フィールド**:
  - `taxonRank: TaxonRank?`（species/genus/family/order/class）
  - `confidenceScore: Float?`（0.0-1.0 の生の値）
  - `habitatPhotoPath: String?`（広角コンテキスト写真）
  - `aiModel: String?`（"tflite_inat" / "gemini_nano" / "perch_v2"）
  - `environment: EnvironmentSnapshot?`（センサースナップショット）
- **既存の CanonicalStore と整合**: `detection_model`, `model_version` フィールドに対応

#### 1-3. SYNC_ENABLED = true + 同期テスト
- **ファイル**: `ikimon-fieldscan/app/src/main/java/life/ikimon/fieldscan/data/SyncManager.kt`
- **内容**: `SYNC_ENABLED = true` に切替、`passive_event.php` への送信テスト
- **既存対応**: `passive_event.php` は `client_session_id` マージ対応済み → FieldScan のセッションIDを渡すだけ

#### 1-4. 加速度計スキャン間隔制御
- **ファイル**: `ikimon-fieldscan/app/src/main/java/life/ikimon/fieldscan/scanner/FieldScanEngine.kt`
- **内容**: `SensorManager.TYPE_ACCELEROMETER` でモーション検知 → 静止10秒/歩行3秒/走行停止
- **効果**: バッテリー寿命2倍 = フィールド滞在時間延長 = 記録量増加

### Phase 2: 環境タイムカプセルの豊かさ

**目標**: Pixel 10 Pro のセンサーを活用し、タイムカプセルのデータ密度を最大化

#### 2-1. 環境センサーデータの構造化スキーマ定義
- **ファイル(サーバー)**: `ikimon.life/upload_package/libs/EnvironmentSchema.php`（新規）
- **内容**: `env_history` の catch-all JSON を構造化:
  ```json
  {
    "temperature_c": 12.0,
    "pressure_hpa": 1013.2,
    "light_lux": 450,
    "compass_bearing": 135,
    "acoustic_indices": { "aci": 2.4, "ndsi": 0.6 },
    "timestamp": "2026-03-24T06:15:00+09:00"
  }
  ```
- **既存対応**: `passive_event.php` L78 の `env_history` をバリデーション付きで受け入れ
- **ADR-002 準拠**: 構造化しつつ後方互換（旧形式も受け入れ可能に）

#### 2-2. Pixel 10 Pro センサー統合（FieldScan側）
- **ファイル**: `ikimon-fieldscan/app/src/main/java/life/ikimon/fieldscan/scanner/SensorScanner.kt`（新規）
- **内容**: `SensorManager` から温度計・気圧計・照度・磁力計を60秒毎に読み取り
- **送信**: `env_history` として `passive_event.php` に送信

#### 2-3. 広角コンテキスト写真の自動撮影
- **ファイル**: `ikimon-fieldscan/app/src/main/java/life/ikimon/fieldscan/scanner/VisualScanner.kt`
- **内容**: セッション開始時 + 100m移動毎に広角レンズで環境写真を自動撮影
- **保存**: Detection の `habitatPhotoPath` に紐付け
- **サーバー**: `scan_detection.php` の `photos[]` に habitat photo として送信

#### 2-4. 音響指数計算
- **ファイル**: `ikimon-fieldscan/app/src/main/java/life/ikimon/fieldscan/scanner/AcousticAnalyzer.kt`（新規）
- **内容**: 連続音声ストリームから ACI/NDSI を60秒ウィンドウで計算
- **AudioScanner とは別ストリーム**: Perch v2 処理のギャップに影響されない
- **送信**: `env_history` の `acoustic_indices` として

#### 2-5. API スキーマ拡張（サーバー側）
- **ファイル**: `ikimon.life/upload_package/public_html/api/v2/passive_event.php`
- **ファイル**: `ikimon.life/upload_package/public_html/api/v2/scan_detection.php`
- **内容**: `environment` フィールドを EnvironmentSchema でバリデーション
- **既存**: `environment_logs` コレクションへの保存は実装済み → スキーマ検証を追加するだけ

### Phase 3: 社会設計 — 人を巻き込む

**目標**: 「あなたの記録が世界を変える過程を見せる」

#### 3-1. プロフィール「あなたの貢献」セクション
- **ファイル**: `ikimon.life/upload_package/public_html/profile.php`
- **既存**: ORS・ライフリスト・成長指標は実装済み
- **追加**:
  ```
  📊 TNFDレポート採用: N件
  🌍 GBIF提供済みレコード: N件
  📅 100年アーカイブ登録: 開始日〜
  🏆 Evidence Tier 2+ 観察: N件（全体のX%）
  ```
- **データソース**: `DwcExportAdapter` のエクスポート履歴 + `ReportEngine` の生成履歴

#### 3-2. 100年アーカイブ説明ページ
- **ファイル**: `ikimon.life/upload_package/public_html/century_archive.php`（新規）
- **内容**:
  - ikimon.life の哲学（「2026年に記録しなかったデータは二度と取り戻せない」）
  - アーカイブの仕組み（DarwinCore, GBIF, 不変保存）
  - 参加の呼びかけ + FieldScan ダウンロード導線
  - 全体の記録統計（累計タイムカプセル数、カバーエリア、参加者数）

#### 3-3. iNaturalist インポート
- **ファイル**: `ikimon.life/upload_package/public_html/api/v2/inaturalist_import.php`（新規）
- **ファイル**: `ikimon.life/upload_package/libs/INaturalistBridge.php`（新規）
- **内容**: iNaturalist API (`/v1/observations`) からユーザーの観察をインポート
- **マッピング**: iNat の observation → ikimon.life の Occurrence（Evidence Tier 1.5 = 外部検証済み）
- **UX**: プロフィール設定から iNaturalist ユーザー名を入力 → 自動インポート

#### 3-4. タイムカプセルの閲覧・共有UI
- **既存**: `get_time_capsule.php` は「去年の今頃」を返す
- **拡張**: FieldScan セッションごとのタイムカプセル詳細ページ
  - 環境データグラフ（温度・気圧・照度の時系列）
  - 音響指数の時系列
  - GPS軌跡マップ
  - 検出種リスト + 証拠写真
  - 共有リンク生成（SNS投稿用）

### Phase 4: デュアル音声エンジン + Fusion

**目標**: BirdNET V3 + Perch v2 のデュアル構成で完全オフライン対応 + マルチモーダル融合

#### 背景: BirdNET V3.0 ライセンス変更（2025-2026）

BirdNET+ V3.0 が **CC BY-SA 4.0** でリリースされ、商用利用が可能になった。
これにより、Codex レビュー時点（2026-03-24）の「BirdNET 不採用」判断を覆す。

| エンジン | ライセンス | 形式 | 種数 | モデルサイズ |
|---------|-----------|------|------|------------|
| BirdNET+ V3.0 | CC BY-SA 4.0 | PyTorch → **ONNX FP16** | ~6,500+ | ~50MB |
| Perch v2 | Apache 2.0 | TFLite | ~14,000+ | ~80MB |

**なぜデュアルか（100年アーカイブ視点）**:
1. **合意 = Evidence Tier 自動昇格**: 2エンジンが同一種を検出 → Tier 1 → 1.5 に自動昇格
2. **不一致 = フラグ**: 片方のみ検出 → コミュニティ検証に回す判断材料
3. **ベンダーロックイン回避**: モデルAが廃止されてもモデルBの記録が残る
4. **種カバレッジ補完**: BirdNET ~6,500 + Perch ~14,000。Perchが拾ってBirdNETが落とすレア種もカバー
5. **独立した2モデルの合意は単独判定より遥かに強い証拠**

#### 4-1. BirdNET V3 ONNX オンデバイス
- **ファイル**: `ikimon-fieldscan/app/src/main/java/life/ikimon/fieldscan/ai/BirdNetV3Engine.kt`（新規）
- **内容**: BirdNET+ V3.0 ONNX FP16 モデルで鳥音声同定
- **ランタイム**: ONNX Runtime Mobile for Android（XNNPACK CPU / NNAPI GPU・NPU）
- **帰属表示**: CC BY-SA 4.0 に従い、about ページ + アプリ内に帰属表示
- **注意**: CC BY-SA の ShareAlike 条件 — モデルをファインチューニングした場合、派生物も同一ライセンスで公開義務

#### 4-2. Perch v2 TFLite オンデバイス
- **ファイル**: `ikimon-fieldscan/app/src/main/java/life/ikimon/fieldscan/ai/PerchEngine.kt`（新規）
- **内容**: Perch v2 TFLite モデルでオンデバイス鳥音声同定
- **AudioScanner 変更**: サーバー呼び出しをローカル推論に切替

#### 4-3. Dual Audio Fusion Engine
- **ファイル**: `ikimon-fieldscan/app/src/main/java/life/ikimon/fieldscan/ai/FusionEngine.kt`（新規）
- **内容**: TFLite種名 × **BirdNET V3種名** × **Perch v2種名** × Nano環境 × センサーデータ → 最終判定
- **音声判定ロジック**:
  ```
  両者合意（同一種） → fusedConfidence = max(bn, perch) + 0.1 bonus, consensus: "agree"
  片方のみ検出       → fusedConfidence = detected_engine * 0.9, consensus: "single"
  両者不一致（別種） → fusedConfidence = max * 0.7, consensus: "disagree", 両候補を記録
  ```
- **既存対応**: `PassiveObservationEngine.php` の `HABITAT_BOOST` / `SEASON_BOOST` と同じ考え方をデバイス側でも
- **Evidence Tier 連動**: `EvidenceTierPromoter.php` に `consensus: "agree"` 時の自動昇格ルールを追加

#### 4-4. Detection スキーマ拡張（デュアル対応）
- **ファイル**: `ikimon-fieldscan/app/src/main/java/life/ikimon/fieldscan/data/Detection.kt`
- **追加フィールド**:
  ```json
  {
    "type": "audio",
    "taxon": "Zosterops japonicus",
    "vernacularName": "メジロ",
    "engines": {
      "birdnet_v3": { "confidence": 0.82, "model": "v3.0-preview3" },
      "perch_v2":   { "confidence": 0.76, "model": "perch-v2.1" }
    },
    "consensus": "agree",
    "fusedConfidence": 0.89,
    "evidenceTier": 1.5
  }
  ```
- **重要**: 両エンジンの生スコアを必ず両方記録。将来モデル更新時の過去データ再評価に必須

#### 4-5. Expert Review Queue + グルーピング
- **FieldScan側**: 同一セッション内の LOW confidence × HIGH quality をグループ化
- **サーバー側**: `expert_review_queue.php`（新規）で Expert 向けUI
- **既存**: 同定センター (`id_center.php`) に Expert Review タブ追加
- **デュアル活用**: `consensus: "disagree"` の検出を優先的にExpert Queueへ

#### 端末リソース試算

| コンポーネント | サイズ | ランタイム |
|--------------|--------|-----------|
| BirdNET V3 (ONNX FP16) | ~50MB | ONNX Runtime Mobile |
| Perch v2 (TFLite) | ~80MB | TensorFlow Lite |
| TFLite 画像同定 | ~30MB | TensorFlow Lite |
| Gemini Nano (環境分析) | 端末内蔵 | Google AI Edge |
| **合計** | **~160MB** | — |

Pixel 10 Pro（256GB/12GB RAM）で余裕。モデルは初回起動時DL（APKサイズ制限150MB回避）。
2エンジン並列推論: 音声3秒チャンク × 各200-400ms。60秒間隔スキャンで1時間あたり合計~48秒の推論時間。バッテリー影響軽微。

### Phase 5: 3Dデジタルツイン（集合知）

**目標**: みんなの写真で生態系の3Dモデルを作る

#### 5-1. フォトグラメトリパイプライン（サーバー側）
- 広角コンテキスト写真を素材に Structure from Motion で3D点群
- 月次バッチ処理
- 結果をサイトダッシュボードで表示

#### 5-2. 種の記録を3D空間にマッピング
- 既存の `EcosystemMapper.php` を拡張（現在 zone 分類まで実装済み）
- 3D点群 + 種の座標 → 統合ビジュアライゼーション

### Phase 6: Station Mode + 調査プロトコル

#### 6-1. Station Mode（FieldScan）
- 動体検知 + 音響トリガー + 環境ログ
- 画面OFF省電力設計

#### 6-2. ポイントカウント / トランセクト
- 標準調査手法のガイドUI
- DarwinCore の `samplingProtocol` フィールド対応

#### 6-3. GBIF データ定期提供
- `DwcExportAdapter.php`（既存）を定期バッチ化
- Tier 2+ データを自動エクスポート

---

## 今日のやりとりの保存計画

### docs/ に戦略文書をコミット

1. `docs/strategy/fieldscan_100y_archive_strategy.md` — Codex 戦略文書のコピー
2. `docs/strategy/fieldscan_codex_review.md` — 今日のCodexレビュー（10項目の衝突と結論）
3. `docs/strategy/fieldscan_implementation_roadmap.md` — この実装ロードマップ

### FIELDSCAN_V02_PLAN.md の更新

`ikimon-fieldscan/docs/FIELDSCAN_V02_PLAN.md` を 100年アーカイブ哲学ベースに全面改訂

### CLAUDE.md への反映

ikimon.life の `CLAUDE.md` に以下を追記:
- 哲学: 「2026年に記録しなかったデータは二度と取り戻せない」
- Phase 15B → Phase 16: 100年アーカイブ基盤
- FieldScan との連携方針

---

## 主要変更ファイル一覧

### FieldScan (ikimon-fieldscan)
| ファイル | 操作 | Phase |
|---------|------|-------|
| `ai/TFLiteEngine.kt` | 新規 | 1 |
| `ai/BirdNetV3Engine.kt` | 新規（ONNX Runtime） | 4 |
| `ai/PerchEngine.kt` | 新規（TFLite） | 4 |
| `ai/GeminiNanoEngine.kt` | 改修（環境分析専任） | 1 |
| `ai/FusionEngine.kt` | 新規（デュアル音声 + 画像 + 環境融合） | 4 |
| `data/Detection.kt` | 改修（taxonRank等追加） | 1 |
| `data/SyncManager.kt` | 改修（SYNC有効化） | 1 |
| `scanner/FieldScanEngine.kt` | 改修（加速度計+Fusion統合） | 1,4 |
| `scanner/VisualScanner.kt` | 改修（広角写真+レンズ提案） | 2 |
| `scanner/AudioScanner.kt` | 改修（オンデバイス化） | 4 |
| `scanner/SensorScanner.kt` | 新規（環境センサー） | 2 |
| `scanner/AcousticAnalyzer.kt` | 新規（音響指数） | 2 |
| `docs/FIELDSCAN_V02_PLAN.md` | 全面改訂 | 今日 |

### ikimon.life (upload_package)
| ファイル | 操作 | Phase |
|---------|------|-------|
| `libs/EnvironmentSchema.php` | 新規 | 2 |
| `libs/INaturalistBridge.php` | 新規 | 3 |
| `api/v2/passive_event.php` | 改修（スキーマ検証追加） | 2 |
| `api/v2/scan_detection.php` | 改修（同上） | 2 |
| `api/v2/inaturalist_import.php` | 新規 | 3 |
| `public_html/profile.php` | 改修（貢献セクション） | 3 |
| `public_html/century_archive.php` | 新規 | 3 |
| `libs/ReportEngine.php` | 改修（音響+環境データ） | 5 |
| `libs/PassiveObservationEngine.php` | 改修（融合確信度） | 4 |

### ドキュメント
| ファイル | 操作 |
|---------|------|
| `ikimon.life/docs/strategy/fieldscan_100y_archive_strategy.md` | 新規（戦略文書保存） |
| `ikimon.life/docs/strategy/fieldscan_codex_review.md` | 新規（レビュー保存） |
| `ikimon.life/docs/strategy/fieldscan_implementation_roadmap.md` | 新規（ロードマップ） |
| `ikimon.life/CLAUDE.md` | 改修（哲学+Phase追加） |
| `ikimon-fieldscan/docs/FIELDSCAN_V02_PLAN.md` | 全面改訂 |

---

## 著作権・法務リスクと対応方針

### ✅ 音声同定ライセンス → デュアルエンジン構成で解決

#### BirdNET+ V3.0（2025-2026 ライセンス変更）
- **ライセンス**: **CC BY-SA 4.0**（商用利用可能 — v2.x の CC BY-NC-SA 4.0 から変更）
- **種数**: ~6,500+ 種
- **形式**: PyTorch → ONNX FP16 変換でオンデバイス実行
- **ランタイム**: ONNX Runtime Mobile for Android
- **帰属表示**: CC BY-SA 4.0 に従い、about ページ + アプリ内に帰属表示
- **ShareAlike 注意**: モデルをファインチューニングした派生物は同一ライセンスで公開義務
- **出典**: [birdnet-team/birdnet-V3.0-dev](https://github.com/birdnet-team/birdnet-V3.0-dev)

#### Google Perch v2
- **ライセンス**: Apache 2.0（商用利用可能）
- **種数**: 14,000+ 種（BirdNET の ~6,500 種を大幅に上回る）
- **訓練データ**: Xeno-canto 全録音（15,000時間+）→ 日本の野鳥もカバー
- **形式**: TensorFlow SavedModel → TFLite 変換でオンデバイス実行可能
- **出典**: Google DeepMind / google-research/perch (GitHub)
- **論文**: Scientific Reports に掲載済み
- **帰属表示**: Apache 2.0 の NOTICE に従い、論文引用を about ページに掲載

#### デュアル構成の設計判断
- **BirdNET V3 + Perch v2 を両方採用**: 合意による Evidence Tier 自動昇格 + ベンダーロックイン回避
- `BirdNetV3Engine.kt`（ONNX Runtime）+ `PerchEngine.kt`（TFLite）の並列推論
- `AudioScanner.kt` のサーバー呼び出し（ikimon.life analyze_audio.php）を完全廃止
- 全ての音声同定がオンデバイスで完結 → 完全オフライン対応
- ikimon.life サーバー側の `analyze_audio.php` は非推奨化（Web版 field_scan 用に残すか検討）

### 🟡 iNaturalist インポートの制約

iNaturalist API は利用可能だが、**一括スクレイピングは規約違反**。

**対応**:
- ユーザー主導のインポート方式を採用: ユーザーが自分の iNat アカウントを OAuth 連携 → 自分の観察のみインポート
- 各観察のライセンス（CC0/CC-BY/CC-BY-NC）を尊重し、ikimon.life 内でもそのライセンスを維持
- 一括ダウンロードではなく、API のレートリミット内で逐次取得
- 規約変更に備え、GBIF 経由のインポート（公開データ）も代替パスとして準備

### 🟡 TFLite 種同定モデルの選定

iNaturalist のフルCV モデルは非公開。

**対応**:
- Google が公開している iNaturalist ベースのモデル（Apache 2.0 ライセンス想定）を第一候補
- `inaturalist/model-files` (GitHub) の小規模モデルをPoC で評価
- ライセンスが不明確なモデルは使用しない。Apache 2.0 / MIT のみ採用

### 🟡 APPI（個人情報保護法）対応

GPS軌跡 + 音声録音 + 写真 → 個人情報に該当。GBIF への国外転送は明示的同意が必須。

**対応**:
1. **FieldScan 初回起動時の同意画面**:
   - GPS軌跡の記録・送信について
   - 音声の録音・AI分析について（人の声が混入する可能性の明示）
   - GBIF への国外データ提供について
2. **音声プライバシー**: VAD（Voice Activity Detection）で人声が検出されたチャンクにフラグ → サーバー送信時に除外
3. **写真の利用範囲**: 投稿時にライセンス選択（CC0/CC-BY/CC-BY-NC）を提供
4. **3Dモデル化**: 写真の3Dモデル利用は別途オプトイン同意
5. **利用規約・プライバシーポリシー更新**: 上記を反映

### 🟡 TNFD レポートでの「市民科学データ」の位置づけ

TNFD 自体にはデータ品質基準がない。「市民科学データで TNFD 対応」と謳う場合、監査可能性が問われる。

**対応**:
- TNFD レポートに使用するのは Evidence Tier 2+（専門家レビュー済み）のデータのみ
- レポート内に「検証済み観察数」vs「未確認観察数」を明記
- GBIF 公開済みデータを根拠として使うことで、第三者検証可能性を担保
- 「市民科学データ → GBIF → TNFD」の data lineage を文書化

### 🟢 炎上リスクの予防

| リスク | 対応 |
|-------|------|
| 「iNaturalist のデータを勝手に使っている」 | OAuth 連携でユーザー主導。規約準拠を about ページで説明 |
| 「GPS で行動追跡している」 | 初回同意 + 設定でGPS精度の切替（高精度/低精度/OFF） |
| 「音声で盗聴している」 | 初回同意 + VAD + 「環境音のみ分析」の明示 |
| 「100年保存と言いながら消える」 | GBIF 提供でプラットフォーム非依存。about ページで保存戦略を公開 |
| 「BirdNET/Perch を無断商用利用」 | BirdNET V3: CC BY-SA 4.0 帰属表示 + ShareAlike。Perch v2: Apache 2.0 帰属表示。両方 about ページで明記 |

---

## 検証方法

| Phase | 検証 |
|-------|------|
| 0 | ~~BirdNET ライセンス~~ → ✅ BirdNET V3.0 が CC BY-SA 4.0 に変更。Perch v2 (Apache 2.0) とデュアル採用 |
| 0 | TFLite モデル候補のライセンス確認 |
| 1 | TFLite 種同定精度テスト（テストデータセット） |
| 1 | ikimon.life ローカルサーバーへの FieldScan 実同期 |
| 1 | APPI 同意画面の UI モック |
| 2 | Pixel 10 Pro 実機センサーデータ取得確認 |
| 2 | タイムカプセル1件の完全データ構造を JSON 出力して検証 |
| 3 | プロフィール「貢献」セクションの表示確認 |
| 3 | iNaturalist OAuth 連携テスト |
| Field | 浜松城公園 45分スキャン → タイムカプセル品質評価 |
