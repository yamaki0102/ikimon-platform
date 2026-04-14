# ikimon.life — 知識OS 統一概要

更新日: 2026-04-15  
対象: Claude / Codex / antigravity など、すべてのエージェント

> **このファイルを30分読めば、どのエージェントでも知識OSの全体像を把握し、どの層からでも作業を始められる。**

---

## 0. 一言ビジョン

**「観察のOS」** — 市民が採った生物観察データを、100年後の研究者が再利用できる形で保全・昇格・公開するプラットフォーム。

---

## 1. 3レイヤー構造（混同禁止）

| Layer | 何 | 正本ドキュメント |
|---|---|---|
| **A. 現行改装** | PHP v1 プロダクトの UX 刷新。Place Intelligence OS へ向かう | `docs/strategy/ikimon_renovation_master_plan_2026-04-11.md` |
| **B. Canonical 化** | JSON → SQLite (`ikimon.db`) への段階的移行。証拠の信頼度管理 | `docs/architecture/ADR-001-canonical-source-of-truth.md` |
| **C. v2 全面切替** | Next.js + Fastify + PostgreSQL の新スタック。parallel rebuild | `docs/architecture/ikimon_v2_zero_base_cutover_master_plan_2026-04-11.md` |

**重要**: タスクに入る前に「これはどのLayerか?」を確認する。混同すると判断を誤る。

---

## 2. 知識OS コンポーネントマップ

```
観察投稿 (post.php)
   │
   ▼
[CanonicalStore] ─── SQLite ikimon.db ─── 5層スキーマ
   │                                        Layer 1: observation_events     (immutable)
   │                                        Layer 2: occurrences            (immutable)
   │                                        Layer 3: evidence_media         (immutable)
   │                                        Layer 4: identification_history (versioned)
   │                                        Layer 5: privacy_access         (policy)
   │
   ├──▶ [ConsensusEngine]     同定 → Tier昇格の合意形成
   │         │
   │         ▼
   │    [DataStageManager]    unverified → casual → research_grade
   │
   ├──▶ [EmbeddingService]    Gemini Embedding 2 (768次元, multimodal)
   │         │
   │         ▼
   │    [OmoikaneDB]          SQLite 100万種 セマンティック逆引き
   │
   └──▶ [CanonicalSync]       既存JSON → DB 継続同期（移行中）
```

---

## 3. Evidence Tier（信頼階層）

```
Tier 1   → AI単独判定（自動）
Tier 1.5 → AI高確信 + 生態学的妥当性チェック（自動昇格）
Tier 2   → コミュニティ検証（1名以上のレビュー）
Tier 3   → 専門家合意（専門家1名 or 一般2名以上）
Tier 4   → 論文・標本等の外部エビデンス紐付き
```

昇格フロー: `ConsensusEngine::evaluate()` → `DataStageManager::promote()`

---

## 4. コンポーネント一覧と実装ファイル

| クラス | ファイル | 役割 | 状態 |
|---|---|---|---|
| `CanonicalStore` | `upload_package/libs/CanonicalStore.php` | SQLite正本 CRUD | ✅ 実装済み |
| `ConsensusEngine` | `upload_package/libs/ConsensusEngine.php` | 同定合意形成 | ✅ 実装済み |
| `DataStageManager` | `upload_package/libs/DataStageManager.php` | ステージ昇格管理 | ✅ 実装済み |
| `CanonicalSync` | `upload_package/libs/CanonicalSync.php` | JSON→DB同期 | ✅ 実装済み |
| `EmbeddingService` | `upload_package/libs/EmbeddingService.php` | Gemini Embedding 2 | 🔧 開発中 |
| `OmoikaneDB` | `upload_package/libs/OmoikaneDB.php` | 種名セマンティック検索 | 🔧 開発中 |
| `AsyncJobMetrics` | `upload_package/libs/AsyncJobMetrics.php` | バックグラウンドジョブ監視 | ✅ 実装済み |

---

## 5. データフロー（フルパス）

```
1. 投稿受付
   POST /api/observations_add.php
   └─ JSON ファイル書込 (data/observations/YYYY-MM.json)  ← 現行正本

2. Canonical取込 (移行中)
   CanonicalSync::syncObservation($obsId)
   └─ ikimon.db の Layer 1-3 に書込

3. AI分類
   EmbeddingService::classify($mediaPath)
   └─ Gemini Flash Lite → taxon候補 + confidence score

4. 自動昇格判定
   ConsensusEngine::autoEvaluate($obsId)
   └─ confidence >= 0.85 + 生態学的妥当性 → Tier 1.5 昇格

5. コミュニティレビュー
   POST /api/identification_add.php
   └─ ConsensusEngine::evaluate($obsId) → 合意判定

6. ステージ昇格
   DataStageManager::promote($obsId, $newTier)
   └─ observation_events.evidence_tier 更新
   └─ identification_history にログ記録

7. 公開・活用
   OmoikaneDB::search($query) → セマンティック逆引き
   export → DwC-A (Darwin Core Archive) 月次
```

---

## 6. Platform v2（TypeScript側）

```
platform_v2/src/
├── app.ts / server.ts       エントリポイント (Fastify)
├── db.ts                    PostgreSQL接続
├── routes/
│   ├── marketing.ts         トップページ・LP
│   ├── write.ts             観察投稿 API
│   ├── read.ts              観察取得 API
│   └── health.ts            ヘルスチェック
├── services/
│   ├── auth.ts              認証
│   └── specialistReview.ts  専門家レビュー
└── scripts/                 移行スクリプト (import*/verify*)
```

**v1 (PHP) ↔ v2 (TS) の契約**: dual-write 戦略。v1が正本の間はv2は読み取り専用。  
切替タイミング: `docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md` を参照。

---

## 7. 技術スタック早見表

| 要素 | v1 (現行) | v2 (移行先) |
|---|---|---|
| 言語 | PHP 8.2 | TypeScript (Node.js) |
| Web | Vanilla PHP | Fastify |
| DB | JSON files + SQLite | PostgreSQL + PostGIS |
| Frontend | Alpine.js + Tailwind CDN | (TBD) |
| AI | Gemini Flash Lite / Embedding 2 | 同左 |
| Hosting | Xserver VPS (162.43.44.131) | 同左 |

---

## 8. エージェント作業ガイド

### タスクに入る前の確認

```
1. これは Layer A / B / C のどれか?
2. 既存コンポーネントを使えるか? (上の表を確認)
3. JSON書込 vs DB書込 どちらが正本か? (現状: JSON が本番正本)
4. v1のみ / v2のみ / dual-write か?
```

### 禁止事項（再掲）

- `DataStore::getAll()` → 存在しない。`fetchAll()` を使う
- `new SiteManager()` → 全メソッドstatic。インスタンス化禁止
- `data/` 配下を直接手編集 → 禁止
- `public_html/` 外へのファイルアップロード → 禁止

### よく触るファイル

```
upload_package/config/config.php         定数定義 (ROOT_DIR等)
upload_package/libs/DataStore.php        JSONストアI/O
upload_package/libs/CanonicalStore.php   SQLite正本
upload_package/public_html/api/          REST APIエンドポイント群
platform_v2/src/routes/                  v2 APIルート
```

---

## 9. 参照ドキュメント優先順（ikimon タスク）

1. **このファイル** (`docs/KNOWLEDGE_OS_OVERVIEW.md`) — 全体像
2. `docs/IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md` — 現在地と計画
3. `docs/IKIMON_KNOWLEDGE_MAP_2026-04-12.md` — 文書の正本索引
4. `docs/architecture/ADR-001-canonical-source-of-truth.md` — Canonical設計
5. `docs/architecture/adr-005-evidence-tier.md` — Evidence Tier仕様
6. `docs/STAGING_RUNBOOK.md` / `docs/DEPLOYMENT.md` — デプロイ手順

---

## 10. 蓄積ルール（どのエージェントでも共通）

新知見・変更はどのエージェントからでも以下の形で記録する:

| 種別 | 記録先 |
|---|---|
| アーキテクチャ決定 | `docs/architecture/ADR-NNN-*.md` 新規作成 |
| 実装状況の変化 | このファイルの §4 テーブルを更新 |
| バグ・制約発見 | `AGENTS.md` の Critical Patterns に追記 |
| 戦略変更 | `docs/IKIMON_MASTER_STATUS_AND_PLAN_*.md` を更新 |
| エージェント固有メモ | Claude: `~/.claude/projects/.../memory/`、Codex: `~/.codex/knowledge/` |

**このファイル自体も更新してよい。** 日付と変更箇所のコメントを先頭に追加する。
