# ikimon.life 開発計画 — Phase 6 実証基盤

> **正本**: `docs/strategy/DEVELOPMENT_PLAN.md`
> **最終更新**: 2026-03-21
> **更新者**: Claude Opus (戦略レビュー v3.8 A評価に基づく)
> **共有対象**: Claude Code / Codex / 八巻
> **戦略文書**: `docs/strategy/v3.8/` (本体 + Appendix A-D)

---

## 方針

- **戦略 v3.8** が A評価到達。S評価には外部アクション（法務レビュー、reviewer確保、愛管ヒアリング、PoC実測）が必要
- 開発は **Phase 6 PoC基盤** に集中。Phase A セットアップ期限: 2026-04-06
- Gemini Embedding 2 は **テキスト検索で導入済み**。マルチモーダル拡張は PoC 後

---

## 現在の技術基盤（確認済み）

### Gemini Embedding 2 実装状況 ✅ 完了

| コンポーネント | ファイル | 状態 |
|---|---|---|
| **EmbeddingService** | `libs/EmbeddingService.php` | ✅ 768次元、マルチモーダル対応（テキスト+画像）、8タスクタイプ |
| **EmbeddingStore** | `libs/EmbeddingStore.php` | ✅ SQLite BLOB、cosine similarity、~100K vectors 2-3秒 |
| **EmbeddingQueue** | `libs/EmbeddingQueue.php` | ✅ 非同期キュー、リトライ3回、20件/バッチ |
| **Semantic Search API** | `api/semantic_search.php` | ✅ テキスト/写真検索、レート制限30回/60秒 |
| **Similar Observations** | `api/get_similar_observations.php` | ✅ ベクトル類似検索 |
| **Omoikane Search** | `api_omoikane_search.php` | ✅ ハイブリッド検索（構造＋セマンティック） |
| **バッチ埋め込み** | `scripts/ingestion/embed_omoikane_species.php` | ✅ オモイカネ種DB |
| **バックフィル** | `scripts/maintenance/backfill_embeddings_768.php` | ✅ 768次元移行済み |

### 既存アーキテクチャ

```
EmbeddingService (768-dim, Matryoshka)
  ├─ embedText() / embedImage() / embedMultimodal()
  ├─ embedObservation() (テキスト+写真→統合ベクトル)
  ├─ batchEmbed() (バッチAPI)
  └─ prepare*Text() (観察/論文/分類/オモイカネ)
       ↓
EmbeddingStore (SQLite float32 BLOB)
  ├─ save() / search() / findSimilar()
  └─ cosine similarity brute-force
       ↓
EmbeddingQueue (非同期処理)
  └─ 20件/run、リトライ3回、5分バックオフ
```

**重要**: 現行は JSON ファイルストレージ (DataStore.php) + Embedding用 SQLite (EmbeddingStore.php) の二重構成。Canonical Schema 実装時に SQLite への統合を検討。

---

## 開発ロードマップ

### Sprint 0: 基盤整備（2026-03-21 〜 03-31）

| # | タスク | 担当 | 依存 | 状態 |
|---|--------|------|------|------|
| 0.1 | 戦略ドキュメント v3.8 をリポジトリ配置 | Claude | — | ✅ 完了 |
| 0.2 | AGENTS.md を Phase 6 対応に更新 | Claude | — | 🔲 |
| 0.3 | Codex 共有環境セットアップ（本ファイル） | Claude | — | 🔄 進行中 |
| 0.4 | Canonical Schema v0.1 のDB設計 | Codex/Claude | — | 🔲 |
| 0.5 | JSON→SQLite 移行パス設計（ADR-005） | Codex/Claude | 0.4 | 🔲 |

### Sprint 1: Phase A セットアップ（2026-04-01 〜 04-06）— Appendix C Phase A

| # | タスク | 担当 | 依存 | 状態 |
|---|--------|------|------|------|
| 1.1 | Canonical Schema v0.1 の5層テーブル実装 | Codex | 0.4 | 🔲 |
| 1.2 | Event Layer: eventID/parentEventID/samplingProtocol 追加 | Codex | 1.1 | 🔲 |
| 1.3 | Occurrence Layer: occurrenceID/basisOfRecord/taxonRank 追加 | Codex | 1.1 | 🔲 |
| 1.4 | Evidence Layer: evidenceID/mediaHash(SHA-256)/captureTimestamp | Codex | 1.1 | 🔲 |
| 1.5 | Identification Layer: identificationMethod/auditLog | Codex | 1.1 | 🔲 |
| 1.6 | PrivacyAccess Layer: coordinatePrecision/accessTier/legalBasis | Codex | 1.1 | 🔲 |
| 1.7 | BirdNET結果インポーター（CSV/JSON → Canonical Schema） | Codex/Claude | 1.1 | 🔲 |
| 1.8 | レビューUI プロトタイプ（承認/棄却/スキップ 3択画面） | Claude | 1.5 | 🔲 |
| 1.9 | Evidence Tier 自動判定ロジック（Tier 1 → 1.5 昇格条件） | Codex | 1.1, B2 | 🔲 |

### Sprint 2: Phase B データ収集基盤（2026-04-07 〜 04-30）

| # | タスク | 担当 | 依存 | 状態 |
|---|--------|------|------|------|
| 2.1 | Reviewer制度の実装（L0-L3 権限、レピュテーションスコア） | Codex/Claude | 1.5 | 🔲 |
| 2.2 | レビューキュー（分類群フィルタ、5分単位バッチ） | Claude | 1.8 | 🔲 |
| 2.3 | 週次KPI自動集計（G1-G7 ダッシュボード） | Codex | 1.1 | 🔲 |
| 2.4 | DwC-A Export Adapter プロトタイプ | Codex | 1.1-1.6 | 🔲 |
| 2.5 | Tier 1→2 昇格ワークフロー（reviewer承認→ステータス更新→監査ログ） | Claude | 2.1, 2.2 | 🔲 |
| 2.6 | Dispute Resolution フロー（B3.2-B3.3 実装） | Codex/Claude | 2.1 | 🔲 |

### Sprint 3: Phase C 評価・判定（2026-06-01 〜 06-15）

| # | タスク | 担当 | 依存 | 状態 |
|---|--------|------|------|------|
| 3.1 | Go/No-Go 判定レポート自動生成 | Codex | 2.3 | 🔲 |
| 3.2 | 1 validated record あたりコスト算出 | Claude | 2.3 | 🔲 |
| 3.3 | Reviewer satisfaction survey 実装 | Claude | 2.1 | 🔲 |
| 3.4 | Assumption Ledger 更新（未検証→ローカル実証済みへの移行） | Claude/Codex | 3.1 | 🔲 |
| 3.5 | TNFD ドラフト出力プロトタイプ（Tier 3→レポート） | Codex | 2.4 | 🔲 |

---

## Claude / Codex 役割分担

| エージェント | 得意領域 | 主な担当 |
|---|---|---|
| **Claude Code** (Opus) | UI/UX、レビュー画面、Alpine.js、統合設計、戦略判断 | レビューUI、KPI表示、ミッションScorecard |
| **Codex** | バックエンド実装、スキーマ設計、バッチ処理、セキュリティ監査 | Canonical Schema、Export Adapter、Tier判定ロジック |
| **共同** | アーキテクチャ決定、ADR作成、テスト設計 | ADR-005、移行計画、E2Eテスト |

### 作業ルール

1. **正本ディレクトリ**: `C:\Users\YAMAKI\ikimon\ikimon.life`（このリポジトリ）
2. **Codex作業ブランチ**: `codex/*` プレフィックス（例: `codex/canonical-schema`）
3. **Claude作業ブランチ**: `claude/*` プレフィックス
4. **main へのマージ**: PR経由。レビュー後にマージ
5. **この計画の更新**: タスク完了時に状態を更新し、コミットに含める
6. **デプロイ**: `ssh -i ~/Downloads/ikimon.pem root@162.43.44.131 /var/www/ikimon.life/deploy.sh`

---

## 技術的な判断事項（要ADR）

| # | 論点 | 選択肢 | 期限 | 状態 |
|---|------|--------|------|------|
| ADR-005 | JSON→SQLite 移行戦略 | A: 一括移行 / B: 段階的（新データのみSQLite、既存は読み取りアダプタ） / C: 並行運用 | Sprint 0 | 🔲 |
| ADR-006 | BirdNET結果の取り込み形式 | A: CSV直接パース / B: BirdNET API / C: JSON中間形式 | Sprint 1 | 🔲 |
| ADR-007 | Reviewer認証方式 | A: 既存セッション拡張 / B: OAuth追加 / C: 招待リンク＋トークン | Sprint 1 | 🔲 |

---

## 外部アクション（S評価到達に必要）

| アクション | 担当 | 期限 | 状態 | 成果物 |
|---|---|---|---|---|
| 法務レビュー依頼（Appendix D送付） | 八巻 | 3月末 | 🔲 | 弁護士メモ |
| 愛管株式会社ヒアリング | 八巻 | 4月中 | 🔲 | 担当者名・5段階評価・導入条件 |
| Reviewer 5名 初期確保 | 八巻 | 4/6 | 🔲 | Day 1チェックリスト完了者リスト |
| Pixel 10 Pro + BirdNET セットアップ | 八巻 | 3/25 | 🔲 | 動作確認スクリーンショット |

---

## 参照ドキュメント

| ドキュメント | パス |
|---|---|
| 戦略本体 v3.8 | `docs/strategy/v3.8/ikimon_life_strategy_2026Q1.md` |
| Appendix A: Privacy | `docs/strategy/v3.8/appendix_a_privacy_governance.md` |
| Appendix B: Reviewer Ops | `docs/strategy/v3.8/appendix_b_reviewer_operations.md` |
| Appendix C: Phase 6 PoC | `docs/strategy/v3.8/appendix_c_phase6_poc.md` |
| Appendix D: 法務レビュー | `docs/strategy/v3.8/appendix_d_legal_review_brief.md` |
| レビュープロンプト v5 | `docs/strategy/v3.8/codex_strategy_review_prompt_v5.md` |
| ADR一覧 | `docs/architecture/adr-*.md` |
| Codexプロンプト集 | `codex-prompts.md` |
| エージェント共通ガイド | `AGENTS.md` |

---

## 更新履歴

| 日付 | 更新者 | 内容 |
|------|--------|------|
| 2026-03-21 | Claude Opus | 初版作成。戦略v3.8 A評価レビュー結果に基づく開発計画 |
