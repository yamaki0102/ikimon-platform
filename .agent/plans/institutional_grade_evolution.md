# ikimon.life — 制度的信頼性 × 持続可能性 進化計画 (Institutional Grade Evolution)
# Created: 2026-02-20
# Updated: 2026-02-21

## 0. 核心となる哲学 (Core Philosophy)
1. **100年後の検証に耐えうるデータ整合性** (100-Year Data Integrity)
   - 学名が変わり、分類が再編されても揺るがない「不変の Taxon Concept ID」をデータ基軸とする。
2. **保護と公開のジレンマの克服** (Balancing Open Data & Conservation)
   - オープンサイエンスの精神（CC0/CC-BY）とレッドリスト希少種の保護（Coordinate Obscuring）の両立。
3. **公正な価値循環モデル** (Fair Value Circulation)
   - 市民がデータを生み出すプロセス（投稿・同定）は**永久無料**。
   - データを消費し、事業価値に変える企業・機関からは**適正な対価**を頂く（Data-as-a-Service）。

---

## 1. 収益モデル: Freemium + Data-as-a-Service

### 料金体系とアクセス権限 (Tier/Gate 設計)

| Tier | 対象 | 月額 | アクセス権限 & 含まれる機能 |
|---|---|---|---|
| **Free** | 市民・学生 | ¥0 | 【API】 100 req/日 (IPベース制限)<br>【機能】 投稿, 同定, ゲーミフィケーション, 個人ダッシュボード |
| **Researcher** | 研究者 | ¥1,980 | 【API】 1,000 req/日 (API Key)<br>【機能】 DwC-A エクスポート (CC BY/CC0のみ), 高度検索 |
| **Enterprise** | 企業 | ¥9,800 | 【API】 無制限<br>【機能】 全データエクスポート, TNFD LEAPレポート, SLA |
| **Government** | 環境省 | 個別 | フルアクセス + カスタム統合 + 研修・専任サポート |

### アーキテクチャ的工夫 (ApiGate)
- データベースへの過度な負荷を避けるため、レートリミット（IPベース/API Keyベース）は `/tmp` の軽量なJSONファイルカウンターで制御（Memcached/Redisと同等の役割をファイルシステムで高速に処理する設計）。

---

## 2. Phase A: 信頼性基盤 (Trust Foundation) - 実装済

### A1. UUID v4 永続識別子
- 新規観察データは推測・衝突不可能な UUID v4 (occurrenceID) で管理。旧体系(hex)はエイリアスとして維持し後方互換を担保。

### A2. 7段階品質フラグ (Data Quality Annotations)
観察データの信頼性を証明するフラグシステム:
1. `has_media` (メディア証拠)
2. `has_location` (GPS座標と精度)
3. `has_date` (観察日)
4. `is_organism` (生物判定 - 将来AI連携)
5. `has_id` (同定支持)
6. `is_wild` (野生/栽培の区別)
7. `is_recent` (過去1年以内の鮮度)

### A3. CC ライセンス明示とフィルタリング
- 投稿時に CC0, CC BY, CC BY-NC 等を付与。（デフォルト: CC-BY）
- Researcher Tier 向けのエクスポートでは、商業利用不可(NC)を除外し、GBIF等に流し込めるクリーンなデータセットのみを提供。

### A4. DwC-A (Darwin Core Archive) エクスポート強化
- `meta.xml`, `eml.xml`, `occurrence.csv` をオンザフライでZIP生成。
- **レッドリスト・マスキング機構**: 希少種データの場合、意図的に座標を丸め（Obscuring）、`coordinateUncertaintyInMeters` と `informationWithheld` (隠蔽理由) を明記して出力。密猟リスクをシステムレベルで遮断。

---

## 3. Phase B: GBIF ネットワーク参加戦略

### B1. 生物多様性インデックス API v2 (Spatial BIS)
- 特定の「サイト（ポリゴン）」に縛られず、純粋な空間座標（Lat/Lng + Radius）で評価する `bio-index.php`。
- Taxon Concept ID を用いた上位種の不変リスト生成。
- 将来的な空間インデックス（PostGIS/Geohash）導入を見据えた、年次推移（YoY Trend）ベースラインの提供。

### B2. GBIF Publisher への道
- 国立科学博物館 (GBIF Japan Node) を経由した公式 Publisher 登録。
- 機関としての EML メタデータ（データセット記述、連絡先、引用方法）の完全な整備。

---

## 4. Phase C & D: 政策ツール化と国際展開 (Next Actions)

### C1. TNFD LEAP レポートエンジン
- 企業のネイチャーポジティブ開示要求に直結する `Locate → Evaluate → Assess → Prepare` フォーマットでの自動レポート生成。

### C2. 30by30 / OECM 環境省対応
- 環境省フォーマット準拠の年次報告書テンプレート出力機能。

### D1. DOI 付与 (Zenodo 連携) & 国際化 (i18n)
- 確定した観測データセットにDOIを付与し、学術論文からのサイテーション（引用）を可能にする機構。
