# ikimon.life 開発計画 — Phase 6 実証基盤

> **正本**: `docs/strategy/DEVELOPMENT_PLAN.md`
> **最終更新**: 2026-03-21
> **更新者**: Claude Opus (コードベース全調査に基づく v2)
> **共有対象**: Claude Code / Codex / 八巻
> **戦略文書**: `docs/strategy/v3.8/` (本体 + Appendix A-D)
> **期間**: 2026-03-22 〜 2026-04-04 (2週間)

---

## 方針

- **戦略 v3.8** が A評価到達。S評価には外部アクション（法務レビュー、reviewer確保、愛管ヒアリング、PoC実測）が必要
- 開発は **Phase 6 PoC基盤** に集中。Phase A セットアップ期限: 2026-04-06
- Gemini Embedding 2 は **テキスト＋画像で導入済み**。マルチモーダル（音声）拡張は PoC 後
- **既存コードの活用を最大化**する。ゼロから作らない

---

## 既存資産の棚卸し（コードベース調査 2026-03-21 実施）

### 「もう存在するもの」 — Phase 6 の出発点

| 領域 | 既存コンポーネント | ファイル | Phase 6 での活用方針 |
|------|-------------------|---------|-------------------|
| **パッシブ検出** | PassiveObservationEngine | `libs/PassiveObservationEngine.php` | BirdNET結果の受け口として拡張。confidence閾値(0.70/0.50/0.30)＋habitat/season boost が既にある |
| **パッシブAPI** | Passive Event API | `api/v2/passive_event.php` | BirdNET CSV→JSON変換後、このAPIに流し込む |
| **信頼度** | TrustLevel (L1-L5) | `libs/TrustLevel.php` | Reviewer L0-L3 にマッピング。L1-2→L0, L3→L1, L4→L2, L5→L3 |
| **同定キュー** | IdentifierQueue | `libs/IdentifierQueue.php` | BirdNET結果のレビューキューとして拡張。分類群フィルタ追加 |
| **品質グレード** | DataQuality (A/B/C/D) | `libs/DataQuality.php` | Evidence Tier (1/1.5/2/3/4) を並行追加。既存グレードは残す |
| **同定UI** | id_workbench.php | `public_html/id_workbench.php` | BirdNET音響レビュー用のビューを追加 |
| **管理者検証** | verification.php | `admin/verification.php` | Speed-IDパネルをreviewer向けに開放 |
| **DwC-A出力** | export_dwca.php 他4本 | `api/export_dwca.php` 他 | Canonical Schema対応版に段階的に移行 |
| **GBIF連携** | GbifService | `libs/Services/GbifService.php` | そのまま活用 |
| **埋め込み** | EmbeddingService/Store/Queue | `libs/Embedding*.php` | BirdNET結果のテキスト埋め込み（種名＋場所＋時間→ベクトル） |
| **AI評価** | AiObservationAssessment | `libs/AiObservationAssessment.php` (1,371行) | Tier 1.5 自動昇格の判定ロジックに活用 |
| **プライバシー** | PrivacyFilter + RedListManager | `libs/PrivacyFilter.php`, `libs/RedListManager.php` | 希少種の座標fuzzing。Tier 1.5から除外するフラグ |
| **監査ログ** | EventLogService | `libs/Services/EventLogService.php` | Identification Layer の auditLog に活用 |
| **テスト** | PHPUnit 16テスト | `tests/Unit/*.php` | PassiveObservationEngineTest.php が既にある。拡張 |

### 「これから作るもの」

| 領域 | 新規コンポーネント | 理由 |
|------|-------------------|------|
| **Evidence Tier** | `evidence_tier` フィールド＋昇格ロジック | 既存DataQuality(A/B/C/D)とは別概念。並行運用 |
| **Canonical Schema** | 5層SQLiteテーブル＋CanonicalStore.php | 観察データの100年保存基盤。ADR-001で決定済み |
| **BirdNETインポーター** | BirdNetImporter.php + CLI | CSV→Canonical Schema変換 |
| **音響レビューUI** | id_workbench.php 内の新ビュー | スペクトログラム表示＋3択（承認/棄却/スキップ） |
| **KPIダッシュボード** | poc_dashboard.php | G1-G7 の進捗可視化 |
| **Reviewer L0-L3 マッピング** | ReviewerLevel.php（TrustLevel拡張） | 戦略B2のreviewer tier を実装 |

---

## Week 1: Sprint 0 — 基盤整備（2026-03-22 〜 03-28）

### Day 1-2 (土日 03/22-23): ADR決定 + Canonical Schema 設計

#### ADR-005: Evidence Tier のデータモデル設計
**背景**: 既存の DataQuality (A/B/C/D) と新しい Evidence Tier (1/1.5/2/3/4) の関係を明確にする

| 選択肢 | 内容 | 推奨 |
|--------|------|------|
| A | DataQuality を Evidence Tier に置き換える | ❌ 破壊的。既存UIが壊れる |
| B | **Evidence Tier を別フィールドとして追加。DataQualityと並行運用** | ✅ 推奨 |
| C | DataQuality を Tier にリネーム | ❌ 意味が異なる（品質 vs 証拠段階） |

**決定事項（B採用の場合）:**
```php
// 観察レコードに追加するフィールド
$obs['evidence_tier'] = 1;        // 1, 1.5, 2, 3, 4
$obs['evidence_tier_at'] = '...'; // Tier変更日時
$obs['evidence_tier_by'] = '...'; // 変更者(AI/reviewer_id)
$obs['evidence_tier_log'] = [];   // 昇格履歴
```

**タスク:**

| # | タスク | 担当 | 成果物 | 工数 |
|---|--------|------|--------|------|
| 0.1 | ADR-005 作成: Evidence Tier データモデル | Claude | `docs/architecture/adr-005-evidence-tier.md` | 1h |
| 0.2 | ADR-006 作成: Canonical Schema のストレージ戦略 | Claude | `docs/architecture/adr-006-canonical-storage.md` | 1h |
| 0.3 | Canonical Schema v0.1 SQLite DDL設計 | Codex | `scripts/migrations/001_canonical_schema.sql` | 2h |

**ADR-006 の論点:**
既存の ADR-001 は PostgreSQL を想定していたが、PoC では SQLite で十分。

| 選択肢 | 内容 | 推奨 |
|--------|------|------|
| A | EmbeddingStore.php と同じ SQLite に Canonical テーブルを追加 | ❌ 責務が混在 |
| B | **専用の canonical.sqlite3 を新設。EmbeddingStore パターンを踏襲** | ✅ 推奨 |
| C | 既存 JSON に evidence_tier フィールドだけ追加（スキーマ移行なし） | △ 最小だがPoC後に作り直し |

**推奨: B + C のハイブリッド**
- 既存観察JSON に `evidence_tier` フィールドを追加（即座に使える）
- Canonical Schema は `canonical.sqlite3` に新設（BirdNET結果はここに直接格納）
- 既存観察→Canonical への同期は Phase B で段階的に

---

### Day 3 (月 03/24): Pixel 10 Pro 到着 + BirdNET 検証

**八巻アクション（開発者自身）:**

| 時間 | アクション | 成果物 |
|------|----------|--------|
| 午前 | Pixel 10 Pro 開封・初期設定 | — |
| 午前 | BirdNET アプリインストール・動作確認 | スクリーンショット |
| 午後 | 自宅近辺で30分間のテスト録音 | BirdNET CSV出力ファイル |
| 午後 | CSV出力フォーマットの確認・共有 | CSVサンプル → リポジトリに配置 |

**開発側（Claude/Codex 並行）:**

| # | タスク | 担当 | 成果物 | 工数 |
|---|--------|------|--------|------|
| 0.4 | CanonicalStore.php 実装 | Codex | `libs/CanonicalStore.php` | 3h |
| 0.5 | 既存観察JSONに evidence_tier フィールド追加 | Claude | DataStore/DataQuality 拡張 | 1h |
| 0.6 | TrustLevel → ReviewerLevel マッピング設計 | Claude | `libs/ReviewerLevel.php` | 2h |

**CanonicalStore.php の設計方針:**

```php
class CanonicalStore {
    // EmbeddingStore.php のパターンを踏襲
    private PDO $db;  // canonical.sqlite3

    // Layer 1: Event
    public function createEvent(array $data): string;  // returns eventID
    public function getEvent(string $eventID): ?array;

    // Layer 2: Occurrence
    public function createOccurrence(string $eventID, array $data): string;
    public function getOccurrencesByEvent(string $eventID): array;
    public function updateEvidenceTier(string $occurrenceID, float $tier, string $by, string $reason): void;

    // Layer 3: Evidence
    public function attachEvidence(string $occurrenceID, array $media): string;

    // Layer 4: Identification
    public function addIdentification(string $occurrenceID, array $id): string;
    public function getIdentifications(string $occurrenceID): array;

    // Layer 5: PrivacyAccess
    public function setAccessTier(string $recordID, string $tier): void;

    // Cross-layer queries
    public function getOccurrenceWithEvidence(string $occurrenceID): array;
    public function searchByTier(float $minTier, int $limit = 50): array;
    public function getKPIMetrics(string $startDate, string $endDate): array;  // G1-G7 用
}
```

**ReviewerLevel.php の設計:**

```php
// 既存 TrustLevel (1-5) と戦略 Reviewer Level (L0-L3) のブリッジ
class ReviewerLevel {
    // マッピング: TrustLevel → Reviewer Level
    const MAPPING = [
        1 => 'L0',  // Observer → 一般ユーザー
        2 => 'L0',  // Naturalist → 一般ユーザー
        3 => 'L1',  // Ranger → Reviewer
        4 => 'L2',  // Guardian → Trusted Reviewer
        5 => 'L3',  // Sage → Expert Reviewer
    ];

    public function getReviewerLevel(string $userId): string;
    public function canApproveTier(string $userId, float $currentTier): bool;
    public function getReviewPermissions(string $userId): array;
}
```

---

### Day 4 (火 03/25): BirdNET CSVフォーマット解析 + インポーター設計

**前提**: 前日のテスト録音で BirdNET CSV を取得済み

| # | タスク | 担当 | 成果物 | 工数 |
|---|--------|------|--------|------|
| 0.7 | BirdNET CSVサンプルをリポジトリに配置 | 八巻 | `tests/fixtures/birdnet_sample.csv` | 15min |
| 0.8 | ADR-007: BirdNET取り込みフォーマット決定 | Claude | `docs/architecture/adr-007-birdnet-import.md` | 1h |
| 0.9 | BirdNetImporter.php 設計 + スケルトン | Codex | `libs/BirdNetImporter.php` | 2h |
| 0.10 | BirdNetImporterTest.php | Codex | `tests/Unit/BirdNetImporterTest.php` | 1h |

**BirdNET CSV の想定フォーマット:**
```csv
Start (s),End (s),Scientific name,Common name,Confidence,File
0.0,3.0,Parus minor,シジュウカラ,0.92,recording_001.wav
3.0,6.0,Hypsipetes amaurotis,ヒヨドリ,0.85,recording_001.wav
```

**BirdNetImporter.php:**
```php
class BirdNetImporter {
    private CanonicalStore $store;
    private PassiveObservationEngine $engine;

    // CSV → Canonical Schema 変換
    public function importCSV(string $csvPath, array $sessionMeta): ImportResult;

    // 1行 → Event + Occurrence + Evidence + Identification
    private function processRow(array $row, array $sessionMeta): array;

    // Tier 1.5 自動昇格判定（Appendix B1 準拠）
    private function evaluateAutoPromotion(array $occurrence): float;

    // sessionMeta に含むもの:
    // - recordedBy: ユーザーID
    // - decimalLatitude / decimalLongitude: GPS
    // - eventDate: 録音日時
    // - captureDevice: "Pixel 10 Pro"
    // - samplingProtocol: "passive-audio"
    // - samplingEffort: "2 hours walk"
}
```

---

### Day 5 (水 03/26): BirdNETインポーター実装 + テスト

| # | タスク | 担当 | 成果物 | 工数 |
|---|--------|------|--------|------|
| 0.11 | BirdNetImporter.php 本実装 | Codex | 完成版 `libs/BirdNetImporter.php` | 3h |
| 0.12 | CLI スクリプト作成 | Codex | `scripts/ingestion/import_birdnet.php` | 1h |
| 0.13 | Tier 1.5 自動昇格ロジック（Appendix B1 準拠） | Claude | `libs/EvidenceTierPromoter.php` | 2h |
| 0.14 | PassiveObservationEngineTest.php に BirdNET テスト追加 | Codex | テスト拡張 | 1h |

**Tier 1.5 自動昇格ロジック（EvidenceTierPromoter.php）:**

```php
class EvidenceTierPromoter {
    private RedListManager $redList;

    /**
     * Appendix B1 準拠:
     * IF  AI_confidence ≥ threshold(species_group, site)
     * AND species IN known_species_list(location, season)
     * AND NOT rare_species_flag
     * THEN auto_promote to Tier 1.5
     */
    public function evaluate(array $occurrence): PromotionResult {
        $confidence = $occurrence['identification_confidence'];
        $species = $occurrence['scientific_name'];
        $lat = $occurrence['decimal_latitude'];
        $lng = $occurrence['decimal_longitude'];
        $month = date('n', strtotime($occurrence['event_date']));

        // 1. 確信度チェック（BirdNET初期値 0.9）
        if ($confidence < $this->getThreshold($species)) {
            return PromotionResult::stay(1, "確信度不足: {$confidence}");
        }

        // 2. 希少種チェック
        if ($this->redList->isRedListed($species, $lat, $lng)) {
            return PromotionResult::stay(1, "希少種: 自動昇格対象外");
        }

        // 3. 生態学的妥当性チェック（地域×季節）
        if (!$this->isEcologicallyPlausible($species, $lat, $lng, $month)) {
            return PromotionResult::stay(1, "生態学的妥当性なし");
        }

        return PromotionResult::promote(1.5, "AI自動昇格");
    }
}
```

**CLI使用例:**
```bash
# BirdNET結果をインポート
php scripts/ingestion/import_birdnet.php \
  --csv=tests/fixtures/birdnet_sample.csv \
  --lat=34.7 --lng=138.1 \
  --user=yamaki \
  --device="Pixel 10 Pro" \
  --date=2026-03-24 \
  --effort="30 minutes walk"

# 結果:
# Imported: 15 occurrences
# Tier 1: 8 (confidence < 0.9 or rare species)
# Tier 1.5: 7 (auto-promoted)
```

---

### Day 6 (木 03/27): 音響レビューUI + ReviewerLevel

| # | タスク | 担当 | 成果物 | 工数 |
|---|--------|------|--------|------|
| 0.15 | ReviewerLevel.php 実装（TrustLevel拡張） | Claude | `libs/ReviewerLevel.php` | 2h |
| 0.16 | id_workbench.php に音響レビュータブ追加 | Claude | UI拡張 | 3h |
| 0.17 | レビューAPI: approve/reject/skip | Codex | `api/v2/review_occurrence.php` | 2h |
| 0.18 | ReviewerLevelTest.php | Claude | `tests/Unit/ReviewerLevelTest.php` | 1h |

**音響レビューUI の設計:**

```
┌────────────────────────────────────────┐
│ 🎵 音響レビュー                 5件待ち │
├────────────────────────────────────────┤
│                                        │
│  シジュウカラ (Parus minor)            │
│  BirdNET確信度: 0.92  |  Tier 1.5      │
│                                        │
│  📍 静岡県浜松市 | 2026-03-24 07:30    │
│  🎤 Pixel 10 Pro | passive-audio       │
│                                        │
│  [▶ 音声再生]  [スペクトログラム表示]    │
│                                        │
│  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │ ✅    │  │ ❌    │  │ ⏭️    │         │
│  │ 承認  │  │ 棄却  │  │ スキップ│         │
│  └──────┘  └──────┘  └──────┘         │
│                                        │
│  [ 別の種を提案... ]                    │
│                                        │
├────────────────────────────────────────┤
│  ◀ 前  |  2/5  |  次 ▶                │
└────────────────────────────────────────┘
```

**API設計 (`api/v2/review_occurrence.php`):**
```
POST /api/v2/review_occurrence.php
{
  "occurrence_id": "occ_xxx",
  "action": "approve" | "reject" | "skip",
  "reviewer_note": "鳴き声の特徴が一致",
  "alternative_taxon": null | "Aegithalos caudatus"  // 棄却時の代替提案
}

Response:
{
  "success": true,
  "new_tier": 2,
  "reviewer_level": "L1",
  "audit_log_id": "log_xxx"
}
```

---

### Day 7 (金 03/28): 統合テスト + Week 1 振り返り

| # | タスク | 担当 | 成果物 | 工数 |
|---|--------|------|--------|------|
| 0.19 | BirdNET CSV → Canonical → レビューUI の E2E テスト | Claude | 手動テスト結果 | 2h |
| 0.20 | `composer test` 全テスト通過確認 | Codex | CI green | 1h |
| 0.21 | Week 1 で発見した問題・設計変更を DEVELOPMENT_PLAN に反映 | Claude | 本ファイル更新 | 30min |
| 0.22 | 進捗コミット＋push | Claude | git push | 15min |

**Week 1 完了時の期待状態:**
```
✅ Canonical Schema SQLite (canonical.sqlite3) が動作
✅ BirdNET CSV → Canonical Schema 変換が動作
✅ Tier 1 / 1.5 の自動判定が動作
✅ ReviewerLevel (L0-L3) が TrustLevel と連動
✅ 音響レビューUI のプロトタイプが id_workbench 上で動作
✅ レビューAPI (approve/reject/skip) が動作
✅ 全テスト通過
```

---

## Week 2: Sprint 1前半 — 昇格ワークフロー + KPI（2026-03-29 〜 04-04）

### Day 8-9 (土日 03/29-30): Tier昇格ワークフロー完成

| # | タスク | 担当 | 成果物 | 工数 |
|---|--------|------|--------|------|
| 1.1 | Tier 1→2 昇格ワークフロー完全実装 | Claude | `libs/TierPromotionWorkflow.php` | 3h |
| 1.2 | 監査ログ記録（EventLogService拡張） | Codex | EventLogService 拡張 | 2h |
| 1.3 | Tier 2→3 合意形成ロジック（Appendix B3 準拠） | Codex | `libs/ConsensusEngine.php` | 3h |
| 1.4 | TierPromotionWorkflowTest.php | Claude | テスト | 1h |

**TierPromotionWorkflow.php:**

```php
class TierPromotionWorkflow {
    /**
     * Tier昇格フロー:
     *
     * Tier 1 (AI候補)
     *   └→ EvidenceTierPromoter::evaluate() → Tier 1.5 (自動)
     *
     * Tier 1 or 1.5
     *   └→ L1+ reviewer が approve → Tier 2
     *       └→ 2名の L1+ が同一 taxon に合意 → Tier 3
     *           └→ 外部監査 → Tier 4 (Phase 7)
     */

    public function processReview(
        string $occurrenceID,
        string $reviewerID,
        string $action,     // approve|reject|skip
        ?string $alternativeTaxon = null,
        ?string $note = null
    ): PromotionResult;

    // Appendix B3.1: クォーラム判定
    private function checkConsensus(string $occurrenceID): ?float;

    // Appendix B3.3: Dispute 検出
    private function detectDispute(array $identifications): bool;
}
```

**ConsensusEngine.php（Appendix B3 準拠）:**

```php
class ConsensusEngine {
    /**
     * B3.1 クォーラム:
     * - 通常種: L1+ 2票の合意 → Tier 3
     * - 希少種: L2+ 2票 or L3 1票 → Tier 3
     * - 困難種: L2+ 2票 + 文献引用 → Tier 3
     *
     * B3.3 Dispute Resolution:
     * - 不合意 → 48h待機 → 3人目招集 → 多数決
     * - L3不在時: Tier 2留め置き + クエスト発行
     */

    public function evaluate(string $occurrenceID): ConsensusResult;
    public function isDisputeResolved(string $occurrenceID): bool;
    public function escalateToExpert(string $occurrenceID): void;
    public function fallbackNoExpert(string $occurrenceID): void;  // B7.3 L3不在時
}
```

---

### Day 10 (月 03/31): KPIダッシュボード設計 + 実装開始

| # | タスク | 担当 | 成果物 | 工数 |
|---|--------|------|--------|------|
| 1.5 | KPIダッシュボード設計（G1-G7 表示） | Claude | ワイヤーフレーム | 1h |
| 1.6 | CanonicalStore::getKPIMetrics() 実装 | Codex | KPI集計SQL | 2h |
| 1.7 | poc_dashboard.php 実装 | Claude | `public_html/poc_dashboard.php` | 3h |

**KPIダッシュボード UI設計:**

```
┌────────────────────────────────────────────────┐
│  📊 Phase 6 PoC Dashboard                      │
│  期間: 2026-04-07 〜 現在 | サイト: 愛管候補地    │
├────────────────────────────────────────────────┤
│                                                │
│  G1 検出量          G2 AI精度        G3 レビュー速度│
│  ┌──────┐         ┌──────┐        ┌──────┐    │
│  │ 12.5 │/時間    │ 84%  │        │ 2.1分 │/件 │
│  │ ✅≥10 │         │ ✅≥80%│        │ ✅≤3分 │    │
│  └──────┘         └──────┘        └──────┘    │
│                                                │
│  G4 昇格速度        G5 Reviewer持続   G6 CPU     │
│  ┌──────┐         ┌──────┐        ┌──────┐    │
│  │ 48h  │中央値   │ 7名  │/月末   │ 45%  │ﾋﾟｰｸ │
│  │ ✅≤72h│         │ ✅≥5名│        │ ✅<70%│    │
│  └──────┘         └──────┘        └──────┘    │
│                                                │
│  G7 ストレージ                                   │
│  ┌──────────────────────────┐                  │
│  │ ████████░░░░░░░  12GB / 50GB   ✅           │
│  └──────────────────────────┘                  │
│                                                │
│  ── Evidence Tier 分布 ──                       │
│  Tier 1:   ████████████  340件                  │
│  Tier 1.5: ██████       185件                   │
│  Tier 2:   ███          92件                    │
│  Tier 3:   █            12件                    │
│                                                │
│  ── 今週のアクティビティ ──                       │
│  月 火 水 木 金 土 日                             │
│  🟩 🟩 🟩 ⬜ ⬜ ⬜ ⬜                             │
│                                                │
│  [Go/No-Go 判定レポート生成]                     │
└────────────────────────────────────────────────┘
```

**getKPIMetrics() の SQL:**
```sql
-- G1: 1時間あたりTier 1イベント数
SELECT COUNT(*) * 1.0 /
  (julianday(MAX(event_date)) - julianday(MIN(event_date))) / 24
FROM occurrences WHERE evidence_tier >= 1;

-- G2: Tier 1.5の正答率（reviewer検証ベース）
SELECT
  COUNT(CASE WHEN o.evidence_tier >= 2 THEN 1 END) * 100.0 / COUNT(*)
FROM occurrences o
WHERE o.evidence_tier_by = 'auto' AND o.evidence_tier >= 1.5;

-- G3: 1件あたりのレビュー時間（中央値）
-- G4: Tier 1→2 所要時間（中央値）
-- G5: 月末のActive reviewer数
-- G6: VPS CPU使用率（サーバーモニタリングAPIから）
-- G7: ストレージ使用量
```

---

### Day 11 (火 04/01): DwC-A Export Adapter 改修

| # | タスク | 担当 | 成果物 | 工数 |
|---|--------|------|--------|------|
| 1.8 | 既存 export_dwca.php のフィールドマッピング確認 | Codex | 差分レポート | 1h |
| 1.9 | Canonical Schema → DwC-A 変換アダプタ | Codex | `libs/DwcExportAdapter.php` | 3h |
| 1.10 | PrivacyAccess Layer の座標丸め実装 | Claude | PrivacyFilter 拡張 | 1h |

**DwcExportAdapter.php:**
```php
class DwcExportAdapter {
    /**
     * Canonical Schema の5層から DwC-A event core +
     * occurrence extension + media extension を生成
     *
     * 戦略v3.8 Section 5.1 のマッピング表に準拠
     * PrivacyAccess Layer の coordinatePrecision を適用
     */

    public function exportOccurrences(float $minTier = 2.0, array $options = []): string;  // CSV
    public function exportDwCA(float $minTier = 3.0): string;  // ZIP archive

    // DwC-DP 将来移行への布石
    public function getSchemaVersion(): string;  // "dwc-a-2024" or future "dwc-dp-2026"
}
```

---

### Day 12 (水 04/02): Reviewer キュー + 分類群フィルタ

| # | タスク | 担当 | 成果物 | 工数 |
|---|--------|------|--------|------|
| 1.11 | IdentifierQueue を BirdNET 結果対応に拡張 | Claude | IdentifierQueue 拡張 | 2h |
| 1.12 | 分類群フィルタ（鳥類/植物/昆虫/哺乳類） | Claude | UI + API | 2h |
| 1.13 | Reviewer Day 1 チェックリスト画面 | Claude | `public_html/reviewer_onboarding.php` | 2h |

**IdentifierQueue 拡張:**
```php
// 既存のスコアリングに追加
const WEIGHT_BIRDNET_AUDIO = 3.0;    // BirdNET結果は優先
const WEIGHT_TIER_PROMOTION = 4.0;   // Tier 1.5→2 昇格待ちは最優先

public function buildReviewQueue(string $userId, array $filters = []): array {
    // $filters['taxon_group'] = 'Aves' | 'Plantae' | 'Insecta' | 'Mammalia'
    // $filters['evidence_tier'] = [1, 1.5]  // レビュー対象のTier
    // $filters['sampling_protocol'] = 'passive-audio'
}
```

---

### Day 13 (木 04/03): 統合テスト + 実データ投入

| # | タスク | 担当 | 成果物 | 工数 |
|---|--------|------|--------|------|
| 1.14 | Pixel 10 Pro で2回目のフィールド録音（1時間） | 八巻 | BirdNET CSV | 2h |
| 1.15 | 実データでの E2E テスト: CSV → Import → Review → Tier昇格 | Claude | テスト結果レポート | 2h |
| 1.16 | バグ修正 + エッジケース対応 | Codex/Claude | 修正コミット | 2h |
| 1.17 | `composer test` 全テスト通過確認 | Codex | CI green | 30min |

**E2Eテスト シナリオ:**
```
1. BirdNET CSV (15件) をインポート
2. → Tier 1: 8件、Tier 1.5: 7件 を確認
3. レビューキューに Tier 1.5 の7件が表示されることを確認
4. 鳥類フィルタで絞り込めることを確認
5. 1件を承認 → Tier 2 に昇格することを確認
6. 監査ログに記録されることを確認
7. KPIダッシュボードに反映されることを確認
8. DwC-A export で Tier 2 以上のみ出力されることを確認
```

---

### Day 14 (金 04/04): Week 2 完了 + デプロイ準備

| # | タスク | 担当 | 成果物 | 工数 |
|---|--------|------|--------|------|
| 1.18 | 全変更を main にマージ（PR経由） | Claude | マージ済みPR | 1h |
| 1.19 | 本番デプロイ | Claude | deploy.sh 実行 | 30min |
| 1.20 | DEVELOPMENT_PLAN.md 更新（完了タスクの反映） | Claude | 本ファイル更新 | 30min |
| 1.21 | 2週間の振り返り + Sprint 2 計画の素案 | Claude | 振り返りメモ | 1h |

**Week 2 完了時の期待状態:**
```
✅ BirdNET CSV → Canonical Schema → レビュー → Tier昇格 の全パイプライン稼働
✅ KPIダッシュボード (G1-G7) がリアルタイム表示
✅ Reviewer レベル (L0-L3) が TrustLevel と連動
✅ 分類群フィルタ付きレビューキュー
✅ DwC-A Export Adapter が Canonical Schema から出力
✅ 監査ログが全アクションを記録
✅ Reviewer Day 1 オンボーディング画面
✅ 実データ（Pixel 10 Pro録音）での動作確認済み
✅ 本番デプロイ済み
```

---

## Claude / Codex 役割分担（2週間）

| エージェント | 主な担当タスク | 判断基準 |
|---|---|---|
| **Claude Code** | UI（レビュー画面、KPIダッシュボード、オンボーディング）、ReviewerLevel、TierPromotionWorkflow、ADR作成、統合テスト | Alpine.js + PHP テンプレート、設計判断、戦略との整合確認 |
| **Codex** | CanonicalStore.php、BirdNetImporter.php、ConsensusEngine.php、DwcExportAdapter.php、SQL設計、テスト | バックエンドロジック、SQLite、データ変換、バッチ処理 |
| **八巻** | Pixel 10 Pro セットアップ、BirdNET テスト録音、Reviewer候補への声掛け、法務レビュー依頼書送付 | 外部アクション、フィールドワーク |

### ブランチ戦略

```
main
├── claude/phase6-evidence-tier      ← Day 1-2: ADR + evidence_tier フィールド
├── codex/canonical-schema           ← Day 3-4: CanonicalStore + BirdNetImporter
├── claude/review-ui                 ← Day 6-7: 音響レビューUI + ReviewerLevel
├── codex/tier-workflow              ← Day 8-9: TierPromotionWorkflow + ConsensusEngine
├── claude/kpi-dashboard             ← Day 10-11: KPIダッシュボード + DwC-A
└── claude/integration               ← Day 13-14: 統合テスト + デプロイ
```

---

## 技術的な判断事項（要ADR）

| # | 論点 | 推奨 | 期限 | 状態 |
|---|------|------|------|------|
| ADR-005 | Evidence Tier のデータモデル | B: 既存 DataQuality と並行。observation JSON に evidence_tier 追加 + canonical.sqlite3 新設 | Day 1 | 🔲 |
| ADR-006 | Canonical Schema のストレージ | B+C: 新規は canonical.sqlite3、既存JSON に evidence_tier フィールド追加 | Day 1 | 🔲 |
| ADR-007 | BirdNET取り込みフォーマット | CSV直接パース（最もシンプル。BirdNETのネイティブ出力） | Day 4 | 🔲 |
| ADR-008 | Reviewer認証方式 | A: 既存セッション＋TrustLevel拡張（新しい認証基盤は不要） | Day 6 | 🔲 |

---

## 外部アクション（S評価到達に必要）

| アクション | 担当 | 期限 | 状態 | 成果物 |
|---|---|---|---|---|
| Pixel 10 Pro + BirdNET セットアップ | 八巻 | 3/24 | 🔲 | 動作確認スクリーンショット + BirdNET CSV |
| 法務レビュー依頼（Appendix D送付） | 八巻 | 3月末 | 🔲 | 弁護士メモ |
| Reviewer候補3名への初回アプローチ | 八巻 | 4/1 | 🔲 | 候補者リスト |
| 愛管株式会社ヒアリング日程調整 | 八巻 | 4月第1週 | 🔲 | 日程確定 |
| フィールド録音 2回目（1時間） | 八巻 | 4/3 | 🔲 | BirdNET CSV + 環境写真 |

---

## リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| BirdNET CSV フォーマットが想定と異なる | Day 4-5 の工数増 | Day 3 にサンプル取得して即確認。フォーマット適応層を挟む |
| Pixel 10 Pro の BirdNET 動作に問題 | PoC 全体に影響 | iPhone 13 Pro をバックアップ。BirdNET は iOS版もある |
| Canonical Schema の設計変更が必要 | Week 2 に波及 | schemaVersion フィールドで移行対応。v0.1 は割り切る |
| TrustLevel→ReviewerLevel のマッピングが不自然 | UX 混乱 | ユーザーには Reviewer Level のみ表示。内部で TrustLevel は維持 |
| `composer test` で既存テストが壊れる | CI 赤 | Day 7, 14 に全テスト確認。既存テストは変更しない方針 |

---

## 参照ドキュメント

| ドキュメント | パス | 用途 |
|---|---|---|
| 戦略本体 v3.8 | `docs/strategy/v3.8/ikimon_life_strategy_2026Q1.md` | §5 Canonical Schema, §14.4 供給能力 |
| Appendix A | `docs/strategy/v3.8/appendix_a_privacy_governance.md` | PrivacyAccess Layer, APPI整理 |
| Appendix B | `docs/strategy/v3.8/appendix_b_reviewer_operations.md` | §B1 Tier定義, §B2 Reviewer制度, §B3 合意形成, §B7 Runbook |
| Appendix C | `docs/strategy/v3.8/appendix_c_phase6_poc.md` | §C3 G1-G7 数値ゲート, §C4 タイムライン |
| Appendix D | `docs/strategy/v3.8/appendix_d_legal_review_brief.md` | 法務レビュー6論点 |
| ADR一覧 | `docs/architecture/adr-*.md` | 既存のアーキテクチャ決定 |
| Codexセットアップ | `CODEX_SETUP.md` | Codex向けクイックスタート |
| Codexプロンプト集 | `codex-prompts.md` | 既存の監査プロンプト |

---

## 更新履歴

| 日付 | 更新者 | 内容 |
|------|--------|------|
| 2026-03-21 | Claude Opus | 初版作成。戦略v3.8 A評価レビュー結果に基づく開発計画 |
| 2026-03-21 | Claude Opus | **v2: コードベース全調査に基づく全面改訂。** 既存資産（PassiveObservationEngine、TrustLevel、IdentifierQueue、DataQuality、DwC-A Export等）の活用方針を明確化。Day 1-14 の日単位計画に詳細化。ADR 4件の論点と推奨を追加。コード設計（クラス構造・メソッドシグネチャ・UI設計）を具体化 |
