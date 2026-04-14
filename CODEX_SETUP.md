# Codex セットアップガイド — ikimon.life Phase 6

## クイックスタート

```bash
# 1. リポジトリクローン（Codex用）
git clone https://github.com/yamaki0102/ikimon-platform.git
cd ikimon-platform

# 2. ブランチ作成（Codex作業用）
git checkout -b codex/<task-name>

# 3. 開発計画を確認
cat docs/strategy/DEVELOPMENT_PLAN.md
```

## Codex が読むべきファイル（優先順）

| 優先度 | ファイル | 内容 |
|--------|---------|------|
| **1** | `AGENTS.md` | 技術スタック、ディレクトリ構造、コード規約、Phase 6概要 |
| **2** | `docs/strategy/DEVELOPMENT_PLAN.md` | 開発計画（Sprint/タスク/担当/状態） |
| **3** | `docs/strategy/v3.8/ikimon_life_strategy_2026Q1.md` §5 | Canonical Schema v0.1 の完全定義 |
| **4** | `docs/strategy/v3.8/appendix_b_reviewer_operations.md` | Reviewer制度・Tier定義・合意形成プロセス |
| **5** | `docs/strategy/v3.8/appendix_c_phase6_poc.md` | PoC数値ゲート G1-G7 |
| **6** | `docs/architecture/adr-001-canonical-schema.md` | スキーマ設計のADR |
| **7** | `codex-prompts.md` | Codex用プロンプト集（セキュリティ/品質/API監査） |

## ブランチ運用

```
main ← PR経由でマージ
├── codex/<task-name>   ← Codex作業ブランチ
├── claude/<task-name>  ← Claude Code作業ブランチ
└── feature/<name>      ← 手動作業ブランチ
```

### ルール
- `main` への直接pushは禁止
- PR タイトルは `[Phase6] <内容>` プレフィックス
- DEVELOPMENT_PLAN.md のタスク状態を更新してコミットに含める
- テスト: `composer test` が通ることを確認

## Codex CLI 実行例

### Phase 6 タスクの実行

```bash
# Sprint 0: Canonical Schema DB設計
codex --approval-mode suggest "
Read docs/strategy/v3.8/ikimon_life_strategy_2026Q1.md Section 5 (Canonical Schema v0.1).
Read docs/architecture/adr-001-canonical-schema.md.
Read upload_package/libs/EmbeddingStore.php for the existing SQLite pattern.

Design a SQLite schema that implements all 5 layers of Canonical Schema v0.1:
- Layer 1: Event
- Layer 2: Occurrence
- Layer 3: Evidence
- Layer 4: Identification
- Layer 5: PrivacyAccess

Requirements:
1. Use the same SQLite pragmas as EmbeddingStore.php (WAL, NORMAL sync, 8MB cache)
2. All field names from the strategy doc Section 5
3. Evidence Tier (1/1.5/2/3/4) as a column on Occurrence
4. schemaVersion field for migration support
5. Foreign keys between layers
6. Indexes on eventID, occurrenceID, evidenceTier, recordedBy

Output:
- SQL CREATE TABLE statements (save to upload_package/scripts/migrations/001_canonical_schema.sql)
- PHP class CanonicalStore.php (save to upload_package/libs/CanonicalStore.php)
- Update docs/strategy/DEVELOPMENT_PLAN.md task 0.4 to completed
"
```

```bash
# Sprint 1: BirdNET結果インポーター
codex --approval-mode auto-edit "
Read docs/strategy/v3.8/appendix_c_phase6_poc.md for BirdNET data format requirements.
Read upload_package/libs/CanonicalStore.php (just created).

Create a BirdNET result importer:
1. Parse BirdNET CSV output (species, confidence, start_time, end_time, file)
2. Map to Canonical Schema: Event + Occurrence + Evidence + Identification
3. Auto-set basisOfRecord = 'MachineObservation'
4. Auto-set samplingProtocol = 'passive-audio'
5. Apply Tier 1.5 auto-promotion logic from Appendix B1
6. Save to upload_package/libs/BirdNetImporter.php
7. CLI script at upload_package/scripts/ingestion/import_birdnet.php
8. Update DEVELOPMENT_PLAN.md task 1.7
"
```

## 開発計画の更新方法

DEVELOPMENT_PLAN.md はクロード/Codex両方が更新する「生きた文書」。

```bash
# タスク完了時
codex --approval-mode auto-edit "
In docs/strategy/DEVELOPMENT_PLAN.md, update task 1.1 status from 🔲 to ✅.
Add a row to the 更新履歴 table:
| 2026-04-XX | Codex | Sprint 1.1 完了: Canonical Schema 5層テーブル実装 |
Commit with message: 'docs: update DEVELOPMENT_PLAN task 1.1 completed'
"
```

## デプロイ

```bash
# release preflight
powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_guardrails.ps1

# 本番デプロイ
git push origin <branch>
# PR作成 → レビュー → mainマージ後:
# GitHub Actions が /var/www/ikimon.life/deploy.sh を実行
```

## 注意事項

1. **config/config.php は変更禁止**（APIキー含む）
2. **data/ ディレクトリは .gitignore 済み**（本番データ）
3. **SiteManager は全メソッド static** — `new SiteManager()` 禁止
4. **DataStore::getAll() は存在しない** — `fetchAll()` を使う
5. **現行は JSON + SQLite(embedding) の二重構成** — Canonical Schema で統合予定
