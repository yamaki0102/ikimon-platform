# ikimon.life 改修ロードマップ

**作成日**: 2026-03-19
**作成者**: Claude Code (Ai / Tactician Azure)
**対象フェーズ**: Phase 2〜7（100年ビジョン逆算設計）
**前提**: 大規模改修OK。現状コードは資産として最大限活用する。

---

## 1. 現状アーキテクチャの全体像

### 1.1 技術スタック全体

```
[フロントエンド]
Alpine.js (CDN) + Tailwind CSS (CDN) + Lucide Icons
MapLibre GL JS + 地理院タイル
Service Worker (PWA) + IndexedDB (オフラインキュー)

[バックエンド]
PHP 8.2 (共有サーバー: お名前ドットコム RS Plan)
セッションベース認証 + UUID ゲストアカウント
Gemini API (AI同定 + Embedding + 論文抽出)

[データ層]
└── JSON ファイルストレージ（メイン観察データ）
    data/observations/YYYY-MM.json  ← パーティション
    data/users.json
    data/library/papers/            ← 1,248件の論文
    data/taxon_resolver.json        ← 304KB
└── SQLite (知識グラフ)
    data/library/omoikane.sqlite3   ← WAL + 768次元embedding BLOB
└── GeoJSON (サイト境界)
    data/sites/{siteId}/boundary.geojson

[インフラ]
ホスティング: お名前ドットコム RS Plan (PHP 8.2 共有)
デプロイ: Zip → SCP → SSH unzip
バックアップ: Google Drive + GitHub
```

### 1.2 コードベース規模

| カテゴリ | 数 | 主要な役割 |
|---------|---|---------|
| PHPライブラリ (libs/) | 81ファイル / ~18,000行 | コア機能・ビジネスロジック |
| APIエンドポイント (api/) | 74個 | REST API群 |
| Webページ (public_html/) | 72ページ | フロントエンド |
| JSコンポーネント (js/) | 20+ファイル | Alpine.js + PWA |
| CLIスクリプト (scripts/) | 140+個 | 管理・データ処理 |
| テスト (tests/Unit/) | 9ファイル | PHPUnit |

### 1.3 現状の強み（活かすべき資産）

| 資産 | ファイル | 評価 |
|-----|--------|-----|
| SQLite 知識グラフ | libs/OmoikaneDB.php, data/library/omoikane.sqlite3 | ✅ 768次元Matryoshka実装済。WAL+インデックス設計良好 |
| セマンティック検索基盤 | libs/OmoikaneSearchEngine.php, libs/EmbeddingService.php | ✅ Phase 1完了。本番稼働可能な状態 |
| 非同期パイプライン | libs/EmbeddingQueue.php, libs/ExtractionQueue.php, libs/AiAssessmentQueue.php | ✅ キューシステム実装済み |
| DwC-A エクスポート | api/export_dwca.php | ✅ Darwin Core Archiveに対応済 |
| PWA基盤 | js/sw.js, js/OfflineManager.js | ✅ ServiceWorker + IndexedDB オフラインキュー |
| Trust Score | libs/TrustScoreCalculator.php, libs/TrustLevel.php | ✅ ハルシネーション率の定量管理 |
| B2B機能群 | libs/CorporateManager.php, libs/ReportEngine.php, api/v2/ | ✅ TNFD/30by30/CSRレポート生成済 |
| PrivacyFilter | libs/PrivacyFilter.php | ✅ 希少種位置マスク（CR:10km, VU:1km） |
| ゲーミフィケーション | libs/Gamification.php, libs/BadgeManager.php, libs/QuestManager.php | ✅ バッジ・クエスト・ストリーク実装済 |
| センサー基盤 | js/PassiveStepTracker.js, js/MotionEngine.js, js/FieldRecorder.js | ✅ Phase 6の土台あり |

### 1.4 現状の弱み（改修が必要な課題）

| 課題 | 影響範囲 | 優先度 |
|-----|--------|------|
| 共有サーバー上でデーモン常駐不可 | scripts/daemon_*.php が本番で使えない | Phase 4で根本解決必要 |
| JSONファイルストレージの書き込みロック競合 | 高トラフィック時にdata/observations/が破損リスク | Phase 3-4で要移行 |
| テストカバレッジが9ファイルのみ | 81ライブラリ中カバーは11% | 全フェーズで危険 |
| api/ ディレクトリが74個の散在ファイル | バージョニング・認証が不統一 | Phase 3で構造化が必要 |
| scripts/ に140+個の使い捨てスクリプト乱立 | 何が本番用か不明確 | Phase 2準備で整理が必要 |
| CDN依存フロントエンド | Alpine.js/Tailwind のバージョン固定ができない | Phase 3でビルドパイプライン検討 |
| 単一言語（PHP）でのAI処理 | Python/Rustの数値計算ライブラリが使えない | Phase 4のVPS移行後に解消 |
| adminページに認証ガードが不統一 | セキュリティホールリスク | 今すぐ修正すべき |

---

## 2. Phase別に必要な改修

### Phase 2: 論文自動取り込み（GBIF/CrossRef/J-STAGE）

**目標**: 人間の介入なしに、学名を起点として世界中の学術論文を取り込み、知識グラフを自律成長させる。

#### 2.1 変更が必要なファイル

| ファイル | 変更内容 | 工数 |
|--------|--------|-----|
| `libs/Services/LibraryService.php` | CrossRef API / J-STAGE API クライアント追加 | M |
| `libs/TaxonPaperIndex.php` | DOI重複チェック、信頼度スコア付きインデクシング | S |
| `libs/PaperStore.php` | ストリーミング書き込み（大量取り込み対応）、バックプレッシャー制御 | M |
| `scripts/ingest_gbif_lit.php` | 現在: GBIF Literatureのみ。追加: CrossRef/J-STAGE連携 | M |
| `scripts/distill_papers.php` | 現在: 実装済みが部分的。生態制約+同定キーの構造化抽出を完成 | L |
| `libs/AiBudgetGuard.php` | 論文蒸留専用の予算枠（月次上限）追加 | S |
| `libs/EmbeddingQueue.php` | 論文テキストのembedding自動キューイング追加 | S |

#### 2.2 新規作成が必要なファイル

| ファイル | 役割 |
|--------|-----|
| `libs/CrossRefClient.php` | CrossRef API クライアント（DOI検索、メタデータ取得） |
| `libs/JStageClient.php` | J-STAGE API クライアント（CiNii/NDL対応含む） |
| `libs/PaperDeduplicator.php` | DOI/タイトル類似度による重複検出（SQLite FTS5活用） |
| `libs/LiteratureIngestionPipeline.php` | GBIF+CrossRef+J-STAGE を統合するオーケストレーター |
| `api/admin/trigger_ingestion.php` | 管理者から手動で取り込みを起動するAPI |
| `public_html/admin/literature_review.php` | 抽出結果のHuman-in-the-Loopレビュー画面 |
| `scripts/ingest_crossref.php` | CrossRef単独CLI |
| `scripts/ingest_jstage.php` | J-STAGE単独CLI |

#### 2.3 スキーマ変更

**omoikane.sqlite3 への追加テーブル**:
```sql
-- 論文メタデータ（既存PaperStoreのJSONをSQLiteへ移行）
CREATE TABLE papers (
  doi TEXT PRIMARY KEY,
  title TEXT,
  authors TEXT,  -- JSON array
  year INTEGER,
  source TEXT,   -- 'gbif_lit' | 'crossref' | 'jstage' | 'manual'
  abstract TEXT,
  full_text TEXT,
  language TEXT DEFAULT 'ja',
  ingested_at TEXT,
  distilled_at TEXT,  -- NULL = 未蒸留
  distill_status TEXT DEFAULT 'pending'  -- pending|processing|done|failed
);

-- 論文-種マッピング（既存TaxonPaperIndexのJSONをSQLiteへ移行）
CREATE TABLE paper_taxa (
  doi TEXT,
  taxon_key TEXT,
  confidence REAL DEFAULT 1.0,
  PRIMARY KEY (doi, taxon_key)
);

-- 蒸留結果（生態制約 + 同定キー）
CREATE TABLE distilled_knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doi TEXT,
  taxon_key TEXT,
  knowledge_type TEXT,  -- 'ecology' | 'id_key' | 'distribution'
  content TEXT,  -- JSON構造化データ
  confidence REAL,
  reviewed_by TEXT,  -- NULL=未レビュー, 'auto'=AI確認済, user_id=人間確認済
  created_at TEXT
);
```

---

### Phase 3: UI統合（自然言語検索、類似観察、同定者UI改善）

**目標**: Phase 1-2で蓄積した知識をユーザーが直感的に使えるUIに変換する。2層ユーザー（パッシブ層 + 同定者）の共存設計。

#### 3.1 変更が必要なファイル

| ファイル | 変更内容 | 工数 |
|--------|--------|-----|
| `public_html/index.php` | パッシブ層向け「今日の発見」ウィジェット追加（難易度ゼロ入口） | M |
| `public_html/id_center.php` | 同定者ファースト: 大量キュー管理UI（ソート/フィルタ/バルク操作） | L |
| `public_html/id_wizard.php` | Phase 2の蒸留同定キーをフローチャートに統合 | L |
| `public_html/species.php` | 論文引用パネル追加（distilled_knowledge からレンダリング） | M |
| `public_html/explore.php` | セマンティック検索バー統合（api/semantic_search.php 連携） | M |
| `api/semantic_search.php` | 自然言語 → embedding → SQLite vec検索 の完全実装 | M |
| `api/get_similar_observations.php` | embedding類似度による類似観察取得 | M |
| `js/ai-assist.js` | 同定精度スコア（Trust Score）の可視化追加 | S |
| `public_html/components/nav.php` | 自然言語検索バーをグローバルナビに追加 | M |

#### 3.2 新規作成が必要なファイル

| ファイル | 役割 |
|--------|-----|
| `public_html/for-identifier/` | 同定者専用ポータル（ダッシュボード + 設定） |
| `public_html/for-identifier/dashboard.php` | 同定待ちキュー / 自分の同定履歴 / Trust Score推移 |
| `public_html/for-identifier/preferences.php` | 得意タクソン設定 / 通知設定 |
| `js/identifier-ui.js` | 同定者向けキーボードショートカット、一括操作 |
| `js/natural-language-search.js` | 検索バーの自然言語処理フロントエンド |
| `api/v2/search.php` | 統合検索API v2（テキスト+セマンティック+フィルタ） |
| `libs/IdentifierQueue.php` | 同定者向けのインテリジェントキュー（得意種優先配信） |
| `libs/DataStageManager.php` | ai_classified → human_verified → research_grade の段階管理 |

#### 3.3 削除・統合すべきファイル

| ファイル | 理由 |
|--------|-----|
| `public_html/id_center.php` | `for-identifier/` ポータルに統合後に削除（リダイレクト残す） |
| `api/search.php` (v1) | `api/v2/search.php` 移行後に非推奨化 |
| `public_html/needs_id.php` | `for-identifier/` に統合 |

#### 3.4 データ段階管理スキーマ（重要）

現在の `observations/*.json` の `quality_grade` フィールドを拡張:
```json
{
  "data_stage": "ai_classified",
  "data_stage_history": [
    {
      "stage": "raw",
      "at": "2026-03-19T10:00:00Z",
      "by": "user_123"
    },
    {
      "stage": "ai_classified",
      "at": "2026-03-19T10:05:00Z",
      "by": "gemini-2.5",
      "confidence": 0.87
    }
  ]
}
```
`ai_classified` → `human_verified` への昇格は Trust Level 3以上の同定者のみ。
`human_verified` → `research_grade` は Trust Level 5、かつ2名以上の合意が必要。

---

### Phase 4: カゴヤVPS移行、sqlite-vec、systemdワーカー常駐

**目標**: 共有サーバーの制約を根本的に解消し、デーモン常駐・高速ベクトル検索・安定運用を実現する。

#### 4.1 変更が必要なファイル

| ファイル | 変更内容 | 工数 |
|--------|--------|-----|
| `config/config.php` | 環境変数ベースの設定に完全移行（DB_PATH, REDIS_URL等） | S |
| `libs/OmoikaneDB.php` | sqlite-vec 拡張のロードと VECTOR INDEX 対応 | L |
| `libs/OmoikaneSearchEngine.php` | FTS5キーワード検索 + vec_search ベクトル検索のハイブリッド化 | L |
| `libs/EmbeddingService.php` | バッチサイズ最適化（現在は逐次、VPSでは並列化可能） | M |
| `libs/DataStore.php` | ファイルロック競合の根本解消（SQLite WAL への全面移行準備） | L |
| `scripts/daemon_extraction_engine.php` | systemd Unit として動く形に修正（PIDファイル、シグナルハンドリング） | M |
| `scripts/daemon_db_writer.php` | 同上 | M |
| `scripts/daemon_prefetcher.php` | 同上 | M |

#### 4.2 新規作成が必要なファイル

| ファイル | 役割 |
|--------|-----|
| `infra/` ディレクトリ新設 | インフラ設定の一元管理 |
| `infra/systemd/ikimon-extraction.service` | 抽出エンジンのsystemd Unit |
| `infra/systemd/ikimon-embedding.service` | Embeddingワーカーのsystemd Unit |
| `infra/systemd/ikimon-dbwriter.service` | DB書き込みワーカーのsystemd Unit |
| `infra/nginx/ikimon.conf` | Nginx設定（PHP-FPM、静的ファイル、gzip） |
| `infra/deploy.sh` | VPS向け自動デプロイスクリプト |
| `infra/backup.sh` | VPS→S3/Backblaze B2 自動バックアップ |
| `libs/ObservationDB.php` | 観察データのSQLite移行レイヤー（JSONからの段階的置き換え） |

#### 4.3 スキーマ変更

**sqlite-vec対応のembeddingsテーブル（omoikane.sqlite3）**:
```sql
-- sqlite-vec 拡張使用
CREATE VIRTUAL TABLE species_vss USING vec0(
  taxon_key TEXT,
  embedding FLOAT[768]
);

-- 観察embedding（Phase 4追加）
CREATE VIRTUAL TABLE observation_vss USING vec0(
  obs_id TEXT,
  embedding FLOAT[768]
);
```

#### 4.4 移行戦略

共有サーバーからVPSへの移行は以下の順序で行う:
1. VPS上でシャドウ環境を構築（DNSは変更しない）
2. `config.php` で環境変数を切り替え可能にする
3. データを rsync でシャドウへコピー（毎時同期）
4. DNS切り替え（ダウンタイム0分目標）
5. 旧共有サーバーを1ヶ月保持後に解約

---

### Phase 5: 100年インフラ化（DwC-A、GBIF連携、長期モニタリング）

**目標**: ikimon.lifeのデータをグローバルな生物多様性ネットワーク（GBIF, iDigBio）と接続し、研究利用可能なデータパブリッシャーになる。

#### 5.1 変更が必要なファイル

| ファイル | 変更内容 | 工数 |
|--------|--------|-----|
| `api/export_dwca.php` | GBIFが要求する完全準拠のDwC-A仕様対応（eml.xml, meta.xml） | L |
| `libs/ReportEngine.php` | 長期モニタリングレポート（5年・10年・20年トレンド）追加 | M |
| `libs/BiodiversityScorer.php` | 種群変化の経年比較指標追加（Change Index） | M |
| `libs/DataQuality.php` | GBIF品質フラグ準拠（coordinateUncertaintyInMeters等） | M |
| `public_html/methodology.php` | BISスコア計算式の透明性開示ページ更新 | S |

#### 5.2 新規作成が必要なファイル

| ファイル | 役割 |
|--------|-----|
| `libs/GbifPublisher.php` | GBIF IPT APIへの自動パブリッシュ |
| `libs/DwcaBuilder.php` | DwC-Aパッケージ（occurrence.csv + multimedia.csv + meta.xml + eml.xml）生成 |
| `libs/LongTermMonitor.php` | 観察データの時系列分析・アノマリー検知 |
| `api/v2/gbif_feed.php` | GBIF クローラー向けの機械可読フィード |
| `public_html/data_portal.php` | 研究者向けデータポータル（ダウンロード + API説明） |
| `public_html/research.php` | 研究機関向けランディングページ |
| `docs/data_schema_v1.md` | 100年後でも読めるデータスキーマ文書 |
| `docs/api_v2.md` | 公開APIドキュメント |

#### 5.3 データ永続化アーキテクチャ（100年設計）

```
primary storage:
  observations.sqlite3         ← 全観察（SQLite、100年後も読める）
  species.sqlite3              ← 種情報（omoikane.sqlite3を分割）
  knowledge.sqlite3            ← 論文・知識グラフ

archival export (年次):
  observations_YYYY.csv        ← Darwin Core形式のCSV
  observations_YYYY_dwca.zip   ← GBIF提出用DwC-A

backup chain:
  VPS local → Backblaze B2 → GitHub LFS（年次スナップショット）
```

---

### Phase 6: パッシブ観察（ウェアラブル + オンデバイスAI）

**目標**: 「歩くだけで生物多様性に貢献できる」体験を実現。専門知識不要のパッシブ層を最大化する。

#### 6.1 変更が必要なファイル

| ファイル | 変更内容 | 工数 |
|--------|--------|-----|
| `js/PassiveStepTracker.js` | バックグラウンド動作の改善（Safari/iOS 制約への対応） | M |
| `js/MotionEngine.js` | 加速度センサーパターン（飛翔・跳躍・静止）→ 種ヒント変換ロジック | L |
| `js/sw.js` | バックグラウンドデータ同期（Background Sync API） | L |
| `libs/MyFieldManager.php` | パッシブ観察専用のセッション種別追加 | M |
| `libs/HabitEngine.php` | パッシブ観察の習慣化スコアリング強化 | M |
| `public_html/ikimon_walk.php` | パッシブ観察モードのUX刷新 | L |

#### 6.2 新規作成が必要なファイル

| ファイル | 役割 |
|--------|-----|
| `libs/PassiveObservationEngine.php` | 位置情報 + センサーデータ → 潜在的観察イベントの抽出 |
| `libs/AudioClassifier.php` | 鳥類音声の特徴抽出（BirdNET API連携、オンデバイスは将来） |
| `libs/WearableAdapter.php` | Bluetooth LE ウェアラブルデバイスとのデータ交換インターフェース |
| `js/AudioCapture.js` | マイク録音 → サーバー送信（鳥声認識） |
| `js/BleWearable.js` | Web Bluetooth API によるウェアラブル接続 |
| `api/v2/passive_event.php` | パッシブ観察イベント受信API（バッチ、端末→サーバー） |
| `public_html/passive_mode.php` | パッシブ観察モードのメインUI（シンプル化） |
| `public_html/contributions.php` | 「あなたの歩きが生態系を守った」ビジュアライズ |

#### 6.3 BOINC for 生物多様性設計

```
[端末のアイドル時間を活用する設計]

端末 (JS):
  - バックグラウンドで位置情報取得（Geolocation API）
  - 加速度センサー常時モニタリング
  - 音声の環境音断片をキャプチャ（オプトイン）
  - IndexedDBにバッファ → Background Sync で定期送信

サーバー (PHP):
  - PassiveObservationEngine が場所×時間×季節で種候補算出
  - 確信度が閾値を超えたらユーザーに確認通知
  - 確認なしでも ai_classified として記録（研究グレードには上げない）

コミュニティ:
  - パッシブ貢献者向けバッジ体系
  - 「あなたがいつも歩く公園」のモニタリング継続記録
```

---

### Phase 7: 生物多様性クレジット（企業向けマネタイズ、TNFD開示対応）

**目標**: ikimon.lifeが認証した生物多様性回復データを、企業のTNFD開示・ESG報告・自然資本会計に接続する収益モデルを構築する。

#### 7.1 変更が必要なファイル

| ファイル | 変更内容 | 工数 |
|--------|--------|-----|
| `libs/BiodiversityScorer.php` | クレジット算出ロジック（BIS変化量 × 面積 × 信頼度）追加 | L |
| `libs/ReportEngine.php` | クレジット証明書PDF生成追加 | M |
| `api/v2/tnfd_leap_report.php` | TNFD LEAP Step 4（評価）の自動化強化 | L |
| `public_html/corporate_dashboard.php` | クレジット残高・履歴・取引画面追加 | L |
| `public_html/pricing.php` | クレジット取引プランの追加 | S |

#### 7.2 新規作成が必要なファイル

| ファイル | 役割 |
|--------|-----|
| `libs/BiodiversityCredit.php` | クレジットの発行・移転・償却ロジック |
| `libs/CreditLedger.php` | 不変台帳（SQLite、追記のみ。改ざん検知用ハッシュチェーン） |
| `libs/CreditVerifier.php` | 外部検証機関APIとの連携（将来: VCS/Gold Standard互換） |
| `libs/ImpactTracker.php` | 企業の介入前後の生物多様性変化の定量化 |
| `api/v2/credit_issue.php` | クレジット発行API（管理者限定） |
| `api/v2/credit_transfer.php` | クレジット移転API（企業間） |
| `api/v2/credit_verify.php` | クレジット真正性確認API（公開） |
| `public_html/credit_marketplace.php` | クレジット市場（売買・オークション） |
| `public_html/impact_report.php` | 企業向けインパクトレポート（投資家配布用） |
| `public_html/methodology_credit.php` | クレジット算出方法論の透明性ページ |

#### 7.3 台帳スキーマ

```sql
-- credits.sqlite3（独立DBファイル。改ざん検知用）
CREATE TABLE credit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_id TEXT UNIQUE NOT NULL,
  issuer TEXT DEFAULT 'ikimon.life',
  site_id TEXT NOT NULL,
  observation_period_start TEXT,
  observation_period_end TEXT,
  species_count_before INTEGER,
  species_count_after INTEGER,
  bis_score_before REAL,
  bis_score_after REAL,
  area_ha REAL,
  credit_unit REAL,  -- BIS向上量 × 面積
  issued_to TEXT,    -- 企業ID
  issued_at TEXT,
  retired_at TEXT,   -- NULL = 有効
  prev_hash TEXT,    -- ハッシュチェーン
  record_hash TEXT   -- SHA256(全フィールド + prev_hash)
);
```

---

## 3. 基盤改修（全Phaseに影響する共通課題）

### 3.1 コードの構造的な問題

#### 問題1: scripts/ の散乱（140+スクリプト）

**現状**: `debug_*.php`, `check_*.php`, `fix_*.php`, `backfill_*.php` が無秩序に混在。
**改修**: 分類整理と不要ファイルの削除。

```
scripts/
├── ingestion/        ← ingest_*.php, gbif_*.php
├── maintenance/      ← backfill_*.php, fix_*.php, reset_*.php
├── workers/          ← daemon_*.php, process_*.php（本番用のみ）
├── analytics/        ← export_*.php, calculate_*.php
└── dev/              ← debug_*.php, check_*.php, test_*.php（本番除外）
```

**今すぐ削除すべきファイル**（デバッグ専用）:
- `scripts/debug_queue.php`
- `scripts/debug_db_direct.php`
- `scripts/debug_distilled.php`
- `scripts/debug_pipeline.php`
- `scripts/debug_assessment.php`
- `scripts/debug_timeline.php`
- `scripts/debug_find.php`
- `scripts/debug_network.php`
- `scripts/debug_taxon.php`
- `scripts/inspect_db.php`, `inspect_db2.php`, `inspect_db3.php`

#### 問題2: API バージョニングの不統一

**現状**: `api/` 直下に74個が混在。`v2/` は3個のみ。
**改修**: 全APIを `api/v2/` に移行。`api/` 直下はレガシー互換のリダイレクトのみ残す。

```php
// api/get_observations.php（旧）
header('Location: /api/v2/observations');
exit;
```

#### 問題3: 認証ガードの不統一

**現状**: 管理画面の一部で `is_admin` チェックが緩い可能性。
**改修**: `libs/ApiGate.php` に管理者確認ミドルウェアを追加し、全adminページで統一適用。

```php
// 全admin/*.php の先頭に追加
require_once ROOT_DIR . 'libs/ApiGate.php';
ApiGate::requireAdmin();
```

#### 問題4: 設定のハードコード

**現状**: `config/config.php` で Gemini APIキーがファイル読み込みに依存。
**改修**: `.env` ファイルと `$_ENV` による環境変数化。

### 3.2 セキュリティ

| 課題 | 対応 | ファイル |
|-----|-----|--------|
| adminページの認証統一 | ApiGate::requireAdmin() 全適用 | `public_html/admin/*.php` 全ファイル |
| ゲストアカウントのレート制限強化 | 投稿3件制限の強化（現在は post.php のみ） | `libs/RateLimiter.php` |
| APIキーの環境変数化 | .env 導入 | `config/config.php` |
| Content-Security-Policy 強化 | インラインスクリプト全廃（nonce化） | `public_html/components/meta.php` |
| SQLiteファイルへの直接アクセス禁止 | .htaccess で `data/*.sqlite3` を 403 | `upload_package/data/.htaccess` |

### 3.3 パフォーマンス

| 課題 | 対応 | 期待効果 |
|-----|-----|--------|
| 観察データのJSON読み込み | SQLiteへ段階的移行（libs/ObservationDB.php） | 10-50× 高速化 |
| CDN依存フロントエンド | バンドルビルド化（Vite等。Phase 4以降） | バージョン固定・オフライン対応 |
| 画像のLazy Loading | `loading="lazy"` の全適用 + WebP最適化 | ページロード30%改善 |
| GBIF APIキャッシュ | `data/gbif_cache/` をSQLiteに移行 | ディスクI/O削減 |
| DataStore.php のファイルロック | 書き込みをキューに通す（Phase 4まで暫定対処） | 競合エラー解消 |

### 3.4 テスト

**現状の危機**: 81ライブラリに対してテストが9ファイル（カバレッジ ~11%）。

**優先的にテストを追加すべきファイル**:

| ファイル | 理由 |
|--------|-----|
| `libs/BiodiversityScorer.php` | B2B収益の根幹。計算ミスは法的リスク |
| `libs/PrivacyFilter.php` | 希少種位置情報の漏洩はレピュテーションリスク |
| `libs/TrustScoreCalculator.php` | 同定品質の根幹。バグは研究データ汚染 |
| `libs/DataStore.php` | ファイルロック競合はデータ損失に直結 |
| `libs/OmoikaneSearchEngine.php` | セマンティック検索の精度保証 |
| `libs/EmbeddingService.php` | embedding品質の回帰テスト |
| `libs/CreditLedger.php` (Phase 7新規) | 金融系ロジック。不変性の保証 |

**目標カバレッジ**: Phase 2完了時点で30%、Phase 4完了時点で60%。

---

## 4. 優先順位付きタスクリスト

### 今すぐやるべき（Phase 2準備、1-2週間）

| # | タスク | ファイル | 理由 |
|---|------|--------|-----|
| 1 | `scripts/` ディレクトリ整理 | `scripts/debug_*.php` 削除等 | 何が本番用か不明瞭で危険 |
| 2 | adminページ認証ガード統一 | `public_html/admin/*.php` | セキュリティホールリスク |
| 3 | `data/*.sqlite3` へのHTTPアクセス禁止 | `data/.htaccess` 作成 | データ漏洩防止 |
| 4 | `libs/CrossRefClient.php` 作成 | 新規 | Phase 2のブロッカー |
| 5 | `libs/JStageClient.php` 作成 | 新規 | Phase 2のブロッカー |
| 6 | omoikane.sqlite3 に `papers` + `paper_taxa` テーブル追加 | `scripts/setup_sqlite.php` | Phase 2データ層 |
| 7 | `BiodiversityScorer` のテスト追加 | `tests/Unit/BiodiversityScorerTest.php` | B2B法的リスク |
| 8 | `PrivacyFilter` のテスト追加 | `tests/Unit/PrivacyFilterTest.php` | 希少種漏洩リスク |

### 3ヶ月以内（Phase 2-3、2026年Q2）

| # | タスク | 工数 |
|---|------|-----|
| 1 | `libs/LiteratureIngestionPipeline.php` 実装（GBIF+CrossRef+J-STAGE統合） | L |
| 2 | `scripts/distill_papers.php` の生態制約+同定キー抽出を完成させる | L |
| 3 | `public_html/admin/literature_review.php` (Human-in-the-Loop) 実装 | M |
| 4 | `libs/DataStageManager.php` でデータ段階管理（ai_classified→research_grade）実装 | M |
| 5 | `api/v2/search.php` 統合検索API v2 実装 | M |
| 6 | `public_html/id_center.php` → 同定者ファースト UI リニューアル | L |
| 7 | `libs/IdentifierQueue.php` 実装（得意種優先配信） | M |
| 8 | 全APIの `api/v2/` 移行（旧エンドポイントはリダイレクト） | L |
| 9 | テストカバレッジ30%達成 | L |

### 6ヶ月以内（Phase 3-4、2026年Q3）

| # | タスク | 工数 |
|---|------|-----|
| 1 | `public_html/for-identifier/` 同定者専用ポータル構築 | L |
| 2 | `public_html/species.php` に論文引用パネル追加 | M |
| 3 | カゴヤVPS移行（シャドウ環境構築 → DNS切り替え） | XL |
| 4 | `infra/systemd/` デーモン設定 + 自動起動 | M |
| 5 | sqlite-vec 拡張のセットアップと `OmoikaneSearchEngine.php` ハイブリッド検索 | L |
| 6 | `libs/ObservationDB.php` 観察データのSQLite移行（段階的） | XL |
| 7 | テストカバレッジ50%達成 | L |

### 1年以内（Phase 4-5、2026年末）

| # | タスク | 工数 |
|---|------|-----|
| 1 | `libs/DwcaBuilder.php` GBIF完全準拠DwC-A実装 | L |
| 2 | `libs/GbifPublisher.php` GBIF IPTへの自動パブリッシュ | M |
| 3 | `public_html/data_portal.php` 研究者向けデータポータル | M |
| 4 | 観察データの全面SQLite移行（JSONは読み取り専用アーカイブ化） | XL |
| 5 | `libs/LongTermMonitor.php` 時系列分析・アノマリー検知 | L |
| 6 | テストカバレッジ60%達成 | L |
| 7 | `docs/data_schema_v1.md` + `docs/api_v2.md` 公開 | M |

### 2年以内（Phase 5-6、2027年）

| # | タスク | 工数 |
|---|------|-----|
| 1 | `libs/PassiveObservationEngine.php` パッシブ観察エンジン実装 | XL |
| 2 | `libs/AudioClassifier.php` 鳥声認識（BirdNET連携） | L |
| 3 | `js/AudioCapture.js` + `api/v2/passive_event.php` 実装 | M |
| 4 | `public_html/passive_mode.php` UX設計 | L |
| 5 | `public_html/contributions.php` 貢献ビジュアライズ | M |
| 6 | iOS PWA制約の回避策（Web Notifications + Background Sync） | L |
| 7 | `public_html/for-researcher.php` リニューアル（データポータル連携） | M |

### 3年以内（Phase 6-7、2028年）

| # | タスク | 工数 |
|---|------|-----|
| 1 | `libs/BiodiversityCredit.php` + `libs/CreditLedger.php` 実装 | XL |
| 2 | `libs/ImpactTracker.php` 企業介入効果の定量化 | L |
| 3 | `public_html/credit_marketplace.php` クレジット市場 | XL |
| 4 | `public_html/impact_report.php` 投資家向けレポート | L |
| 5 | `libs/WearableAdapter.php` + `js/BleWearable.js` ウェアラブル連携 | XL |
| 6 | オンデバイスAI推論（ONNX Runtime for Web） | XL |
| 7 | VCS/Gold Standard互換の認証フレームワーク連携 | XL |

---

## 5. 技術的判断ポイント

### 5.1 共有サーバー→VPS移行のタイミング判断基準

**移行を決断するトリガー条件（いずれか1つ以上）**:

| 指標 | 閾値 | 現在値（推定） |
|-----|-----|-------------|
| 月次観察投稿数 | 5,000件以上 | ~100件 |
| Embedding処理のバックログ | 常時100件以上 | 散発的 |
| 論文蒸留キューの待ち時間 | 48時間以上 | 未計測 |
| Gemini API月次コスト | ¥30,000以上 | ~¥5,000 |
| 共有サーバーのCPU制限エラー | 週1回以上 | なし |

**推奨移行時期**: Phase 2（論文取り込み）が本格稼働し、embedding処理が週1000件を超えた時点。
→ **想定: 2026年Q3**

**推奨サーバー**: カゴヤVPS SSD20 (2コア/2GB/SSD20GB) → スケール時はメモリ4GB品に変更
**月額コスト**: 約¥2,200（現在の共有サーバーより安い可能性あり）

### 5.2 PWA vs ネイティブアプリの判断

**現在の判断: PWA維持（Phase 6まで）**

| 観点 | PWA | ネイティブ |
|-----|-----|---------|
| 開発コスト | ✅ 既存コード再利用 | ❌ iOS/Android別開発 |
| センサーアクセス | ⚠️ GPS/加速度はOK、Bluetooth制限あり | ✅ 全センサー利用可 |
| バックグラウンド動作 | ⚠️ iOS Safariで制限 | ✅ 制限なし |
| 配布コスト | ✅ なし | ❌ App Store審査 |
| オフライン | ✅ Service Worker | ✅ |

**ネイティブ移行を検討するタイミング**:
- ウェアラブル（BLE）連携が主要機能になった時点（Phase 6後半）
- MAUが10,000人を超えた時点
- iOSのPWAバックグラウンド制限が回避困難と判断した時点

**推奨**: Phase 6でReact Native（Expo）によるハイブリッド実装を検討する。
PHPバックエンドはそのまま使える。

### 5.3 API設計のバージョニング方針

**採用する方針: URI バージョニング（`/api/v2/`）**

```
/api/v1/  ← 旧エンドポイント（廃止予定、リダイレクトのみ）
/api/v2/  ← 現行（Phase 3から全面移行）
/api/v3/  ← Phase 5以降（GBIF準拠の公開API）
```

**バージョン互換性ルール**:
- 同じメジャーバージョン内: 後方互換を維持（フィールド追加はOK、削除はNG）
- メジャーバージョンアップ: 最低6ヶ月は旧バージョンを並走
- 廃止通知: APIレスポンスヘッダー `Deprecation: true` + `Sunset: 2027-03-01` を追加

**認証統一** (Phase 3で実装):
```php
// 全api/v2/ファイルの先頭
require_once ROOT_DIR . 'libs/ApiGate.php';
ApiGate::authenticate();  // セッション or Bearer Token
```

### 5.4 データマイグレーション戦略

**観察データのJSON→SQLite移行（最大のリスク）**

段階的移行（デュアルライト方式）:

```
Stage 1（Phase 3）: 新規投稿はJSONとSQLite両方に書く
  libs/DataStore.php に SQLite書き込みを追加（既存のJSON書き込みは維持）

Stage 2（Phase 4）: 読み取りをSQLiteから行う
  libs/ObservationDB.php を作成し、DataStore.php をラップ

Stage 3（Phase 5）: 既存JSONをSQLiteにバックフィル
  scripts/migrate_observations_to_sqlite.php で一括変換

Stage 4（Phase 5完了後）: JSON書き込みを停止（JSONはアーカイブ）
  DataStore.php の JSON書き込みを削除
```

**ロールバック設計**: 各Stageで `config.php` の `DB_BACKEND` フラグ（`'json'` | `'dual'` | `'sqlite'`）で切り替え可能にする。

---

## 付録: ファイル別改修インパクト一覧

### 高インパクト（全Phase影響）

| ファイル | 変更理由 | 変更時期 |
|--------|--------|--------|
| `libs/DataStore.php` | SQLite移行の根幹 | Phase 3-5 |
| `libs/OmoikaneDB.php` | sqlite-vec対応、スキーマ拡張 | Phase 2, 4 |
| `config/config.php` | 環境変数化、DB_BACKENDフラグ | Phase 3 |
| `libs/Auth.php` | API Bearer Token認証追加 | Phase 3 |
| `libs/ApiGate.php` | 認証統一、バージョニング | Phase 3 |

### 中インパクト（特定Phase影響）

| ファイル | 変更理由 | 変更時期 |
|--------|--------|--------|
| `libs/EmbeddingService.php` | 並列化、バッチ最適化 | Phase 4 |
| `libs/BiodiversityScorer.php` | クレジット算出追加 | Phase 7 |
| `libs/ReportEngine.php` | 長期モニタリング、クレジット証明書 | Phase 5, 7 |
| `public_html/id_center.php` | 同定者UI刷新 | Phase 3 |
| `api/export_dwca.php` | GBIF完全準拠 | Phase 5 |

### 削除候補（将来的に不要になるもの）

| ファイル | 削除時期 | 理由 |
|--------|--------|-----|
| `data/library/papers/*.json` | Phase 5完了後 | SQLite移行後はアーカイブのみ |
| `data/embeddings/` (JSON時代の残骸) | Phase 2完了時 | omoikane.sqlite3に統合済 |
| `scripts/debug_*.php` (10+ファイル) | 今すぐ | 本番に不要 |
| `api/v1/` レガシーエンドポイント | Phase 5 | 廃止宣言後1年 |
| `public_html/id_center.php` | Phase 3 | for-identifier/に統合 |
| `public_html/needs_id.php` | Phase 3 | for-identifier/に統合 |

---

*作成: 2026-03-19 by Claude Code (Ai / Tactician Azure)*
*次回レビュー推奨: Phase 2完了時点（想定: 2026年Q2）*
