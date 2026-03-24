# ikimon.life + BioScan 開発計画 2026 Q2-Q3

> **「2026年に記録しなかったデータは二度と取り戻せない」**

作成: 2026-03-24
参照: bioscan_100y_archive_strategy.md / walk_livescan_unification.md / bioscan_implementation_roadmap.md

---

## 全体マップ

```
2026年
 4月          5月          6月          7月          8月          9月
 ├─ Sprint 1 ─┤─ Sprint 2 ─┤─ Sprint 3 ─┤─ Sprint 4 ─┤─ Sprint 5 ─┤─ Sprint 6 ─┤
 │             │             │             │             │             │
 │ ❶ さんぽ統合│ ❷ 散歩レポ │ ❸ BioScan  │ ❹ 環境セン │ ❺ 社会設計 │ ❻ Station  │
 │  + 自然浴   │  + 貢献可視 │  基盤修正   │  サー統合   │  + 連携     │  + 調査     │
 │  スコア     │  化         │             │             │             │  プロトコル │
 │             │             │             │             │             │             │
 │ ── Web ──  │ ── Web ──  │ ─ Android ─ │ ─ Android ─ │ ── Web ──  │ ── 両方 ── │
```

**原則**: Web（ikimon.life）を先にやる。ユーザーの多い方から。BioScan は「ブラウザでは取れないデータ」に集中。

---

## Sprint 1（4月前半〜後半）: さんぽ統合 + 自然浴スコア

**ゴール**: 3ページをfield_research.phpに統合。散歩が楽しくなる体験を作る。

### Web（ikimon.life）

| # | タスク | ファイル | 工数 |
|---|--------|---------|------|
| 1-1 | field_research.php にモード切替UI追加（あるく/スキャン/静か） | `field_research.php` | M |
| 1-2 | field_scan.php の LiveScanner ロジックを field_research に移植 | `js/LiveScanner.js`（新規） | L |
| 1-3 | スキャンモード時のカメラプレビュー ↔ マップ切替UI | `field_research.php` | M |
| 1-4 | 「あるく」モードのデフォルト体験（マップ中心 + 音声検出通知カード） | `field_research.php` | M |
| 1-5 | NatureScore API（自然浴スコア算出） | `api/v2/nature_score.php`（新規） | S |
| 1-6 | walk.php → field_research.php リダイレクト | `walk.php` | XS |
| 1-7 | field_scan.php → field_research.php リダイレクト | `field_scan.php` | XS |

### 検証
- ブラウザで field_research.php を開き、3モード全てで動作確認
- 「あるく」モードでポケット放置 → 音声検出が動くか
- 「スキャン」モードでカメラ検出 → マップに検出ドット表示
- 旧URL（walk.php, field_scan.php）からのリダイレクト確認

---

## Sprint 2（5月前半〜後半）: 散歩レポート + 貢献可視化

**ゴール**: セッション終了が「達成感」になる。自分の記録が使われた実感を持てる。

### Web（ikimon.life）

| # | タスク | ファイル | 工数 |
|---|--------|---------|------|
| 2-1 | セッション終了画面を「散歩レポート」にリデザイン | `js/SessionReporter.js`（新規） | L |
| 2-2 | 自然浴スコアの表示（NatureScore.js） | `js/NatureScore.js`（新規） | S |
| 2-3 | 種カード横スクロールUI（信頼度色分け + タップで詳細） | `SessionReporter.js` | M |
| 2-4 | 週間累計表示（今週N回・N種・Nkm） | `SessionReporter.js` | S |
| 2-5 | プロフィール「あなたの貢献」セクション追加 | `profile.php` | M |
| 2-6 | GBIF提供済みレコード数の表示 | `profile.php` + `DwcExportAdapter.php` | S |
| 2-7 | Evidence Tier 2+ 観察数の表示 | `profile.php` | S |
| 2-8 | 100年アーカイブ説明ページ | `century_archive.php`（新規） | M |

### 検証
- 45分の散歩セッション → 散歩レポートのスクリーンショット品質確認
- 自然浴スコアが直感的に「良い散歩だった」と感じるか
- プロフィールの「貢献」が正しい数字を出すか
- century_archive.php のメッセージが哲学を正しく伝えているか

---

## Sprint 3（6月前半〜後半）: BioScan 基盤修正

**ゴール**: BioScan のデータが ikimon.life に流れる。種レベル同定が動く。

### Android（ikimon-bioscan）

| # | タスク | ファイル | 工数 |
|---|--------|---------|------|
| 3-1 | TFLite 種同定モデル調査・選定・PoC | `ai/TFLiteEngine.kt`（新規） | L |
| 3-2 | Detection に taxonRank, confidenceScore, aiModel, environment 追加 | `data/Detection.kt` | S |
| 3-3 | GeminiNanoEngine プロンプトを環境分析専任に変更 | `ai/GeminiNanoEngine.kt` | S |
| 3-4 | SYNC_ENABLED = true + passive_event.php への送信テスト | `data/SyncManager.kt` | M |
| 3-5 | 加速度計スキャン間隔制御（静止10秒/歩行3秒/走行停止） | `scanner/BioScanEngine.kt` | M |
| 3-6 | APPI同意画面（GPS・音声・GBIF国外転送） | `ui/ConsentScreen.kt`（新規） | M |

### 検証
- TFLite モデルで日本の一般的な種（シジュウカラ等）を正しく同定できるか
- BioScan → ikimon.life ローカルサーバーへの実送信テスト
- 加速度計: 静止→歩行→走行でスキャン間隔が変わるか
- 同意画面のフロー確認

---

## Sprint 4（7月前半〜後半）: 環境センサー統合

**ゴール**: Pixel 10 Pro のセンサーを全部使う。タイムカプセルが最も豊かになる。

### Android（ikimon-bioscan）

| # | タスク | ファイル | 工数 |
|---|--------|---------|------|
| 4-1 | SensorScanner 新規作成（温度計・気圧計・照度・磁力計、60秒毎） | `scanner/SensorScanner.kt`（新規） | M |
| 4-2 | 広角コンテキスト写真の自動撮影（開始時+100m移動毎） | `scanner/VisualScanner.kt` | M |
| 4-3 | Perch v2 TFLite オンデバイス鳥音声同定 | `ai/PerchEngine.kt`（新規） | L |
| 4-4 | AudioScanner をオンデバイス化（サーバー呼び出し廃止） | `scanner/AudioScanner.kt` | M |
| 4-5 | AcousticAnalyzer（ACI/NDSI を60秒ウィンドウで計算） | `scanner/AcousticAnalyzer.kt`（新規） | L |
| 4-6 | VAD（人声検出）→ フラグ付きで送信除外 | `scanner/AudioScanner.kt` | M |

### Web（ikimon.life）

| # | タスク | ファイル | 工数 |
|---|--------|---------|------|
| 4-7 | EnvironmentSchema.php（環境センサーデータ構造化バリデーション） | `libs/EnvironmentSchema.php`（新規） | S |
| 4-8 | passive_event.php にスキーマ検証追加 | `api/v2/passive_event.php` | S |
| 4-9 | scan_detection.php に同上 | `api/v2/scan_detection.php` | S |

### 検証
- Pixel 10 Pro 実機でセンサー値が正しく取れるか（既知の温度計と比較等）
- Perch v2 で日本の野鳥録音を正しく同定できるか
- ACI/NDSI の値が既知の録音データで妥当か
- タイムカプセル1件の完全JSON出力を確認
- 環境データが ikimon.life に正しく保存されるか

---

## Sprint 5（8月前半〜後半）: 社会設計 + 外部連携

**ゴール**: iNaturalist ユーザーを取り込む。記録が使われた実感を強化する。

### Web（ikimon.life）

| # | タスク | ファイル | 工数 |
|---|--------|---------|------|
| 5-1 | iNaturalist OAuth連携インポート | `libs/INaturalistBridge.php`（新規） | L |
| 5-2 | iNaturalist インポートUI（プロフィール設定） | `api/v2/inaturalist_import.php`（新規） | M |
| 5-3 | タイムカプセル詳細ページ（環境データグラフ+GPS軌跡+種リスト） | 新規ページ | L |
| 5-4 | タイムカプセル共有リンク生成（SNS投稿用OGP） | 上記ページ | S |
| 5-5 | 散歩レポートに「BioScanで記録するともっと豊かなデータに」導線 | `SessionReporter.js` | XS |

### Android（ikimon-bioscan）

| # | タスク | ファイル | 工数 |
|---|--------|---------|------|
| 5-6 | Sensory Fusion Engine（TFLite × Perch v2 × Nano × センサー → 最終判定） | `ai/FusionEngine.kt`（新規） | L |
| 5-7 | セッション終了 → ikimon.life 散歩レポートURLを開く | `ui/BioScanScreen.kt` | S |

### 検証
- iNaturalist テストアカウントから観察をインポートできるか
- インポートした観察がフィードに正しく表示されるか（ライセンス維持）
- タイムカプセル詳細ページのOGP表示
- Fusion Engine: 視覚+音声の融合で確信度が適切に上がるか

---

## Sprint 6（9月前半〜後半）: Station Mode + 調査プロトコル

**ゴール**: 定点観測と科学的調査への対応。研究者との接続。

### Android（ikimon-bioscan）

| # | タスク | ファイル | 工数 |
|---|--------|---------|------|
| 6-1 | Station Mode 基本（画面OFF + 音響常時監視 + 動体検知トリガー） | `scanner/BioScanEngine.kt` | L |
| 6-2 | 夜間モード（Night Sight統合） | `scanner/VisualScanner.kt` | M |
| 6-3 | ポイントカウントプロトコル（タイマー+距離帯） | `ui/SurveyScreen.kt`（新規） | M |

### Web（ikimon.life）

| # | タスク | ファイル | 工数 |
|---|--------|---------|------|
| 6-4 | DarwinCore エクスポート定期バッチ化 | `libs/DwcExportAdapter.php` | M |
| 6-5 | ReportEngine に音響+環境センサーデータ統合 | `libs/ReportEngine.php` | M |
| 6-6 | GBIF データ提供パイプライン（Tier 2+ 自動エクスポート） | `scripts/gbif_export_batch.php`（新規） | M |

### 検証
- Station Mode: 三脚固定2時間 → バッテリー消費実測 → 検出数確認
- ポイントカウント: 5分タイマー → DarwinCore samplingProtocol 出力確認
- GBIF エクスポートが品質要件を満たすか

---

## 工数サマリー

| Sprint | 期間 | 対象 | タスク数 | 規模感 |
|--------|------|------|---------|--------|
| 1 | 4月 | Web | 7 | 中（既存コード移植中心） |
| 2 | 5月 | Web | 8 | 中（UI新規 + API 1本） |
| 3 | 6月 | Android | 6 | 大（TFLiteモデル選定がクリティカルパス） |
| 4 | 7月 | Android + Web | 9 | 大（Perch v2統合 + センサー全開） |
| 5 | 8月 | Web + Android | 7 | 大（iNat連携 + Fusion Engine） |
| 6 | 9月 | Android + Web | 6 | 大（Station Mode + GBIF本番） |

---

## クリティカルパスと依存関係

```
Sprint 1 (さんぽ統合)
  └→ Sprint 2 (散歩レポート) ← Sprint 1 の統合UIが前提
       └→ Sprint 5-5 (BioScan導線) ← 散歩レポートが前提

Sprint 3 (BioScan基盤)
  ├→ Sprint 4 (センサー) ← SYNC + TFLite が前提
  │    └→ Sprint 5-6 (Fusion) ← 全AIエンジンが前提
  └→ Sprint 6-1 (Station) ← 基盤が安定していること

Sprint 5-1 (iNat連携) ← 独立。いつでも着手可能
Sprint 6-4 (GBIF) ← 独立。いつでも着手可能
```

**最大のリスク**: Sprint 3 の TFLite モデル選定。
Apache 2.0 で日本の種を十分カバーするモデルが見つからない場合、代替案の検討が必要。
→ **4月中にモデル候補のPoC評価を先行実施する（Sprint 0 タスク）**

---

## Sprint 0（3月残り〜4月初旬）: 先行調査

| # | タスク | 担当 | 期限 |
|---|--------|------|------|
| 0-1 | TFLite 種同定モデル候補のライセンス確認 + PoC | 開発 | 4/7 |
| 0-2 | Perch v2 の日本野鳥カバー率確認（GitHub issue or テスト） | 開発 | 4/7 |
| 0-3 | iNaturalist API 利用規約の詳細レビュー | 開発 | 4/14 |
| 0-4 | 利用規約・プライバシーポリシーの APPI 対応ドラフト | 開発 | 4/14 |

---

## 成功指標

| 指標 | Sprint 2 完了時 | Sprint 4 完了時 | Sprint 6 完了時 |
|------|----------------|----------------|----------------|
| 週間アクティブさんぽユーザー | 基準値測定 | +20% | +50% |
| セッションあたり平均種数 | 基準値測定 | +30%（AI改善） | +50% |
| BioScan インストール数 | - | 50 | 200 |
| BioScan → ikimon.life 同期率 | - | 80%+ | 90%+ |
| 環境センサー付きタイムカプセル比率 | 0% | 10% | 20% |
| GBIF 提供レコード数 | 0 | 0 | 初回エクスポート |
| 自然浴スコア平均 | 基準値測定 | 基準値測定 | トレンド確認 |

---

## この計画を支える哲学

- **入口**: 散歩が楽しくなる（ウェルビーイング）・地域を知れる（地方創生）・仲間ができる（コミュニティ）
- **継続動機**: 自分の記録が社会に使われた実感
- **結果**: 100年アーカイブが副産物として育つ
- **優先順位**: Web（多くの人の入口）→ BioScan（豊かなデータの上位層）
- **BioScan の焦点**: ブラウザでは取れないデータだけ

---

*作成: 2026-03-24*
