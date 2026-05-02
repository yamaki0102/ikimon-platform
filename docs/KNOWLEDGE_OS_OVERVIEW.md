# ikimon.life — 知識OS 統一概要

更新日: 2026-04-30
対象: Claude / Codex / antigravity など、すべてのエージェント

> **このファイルは入口であり、単独の最終正本ではない。**
> 現在地の確認は `docs/IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md`、
> 正本索引は `docs/IKIMON_KNOWLEDGE_MAP_2026-04-12.md` を必ず併読すること。

---

## 0. 一言ビジョン

**「観察のOS」** — 市民が採った生物観察データを、100年後の研究者が再利用できる形で保全・昇格・公開するプラットフォーム。

---

## 1. 3レイヤー構造（混同禁止）

| Layer | 何 | 正本ドキュメント |
|---|---|---|
| **A. 現行改装** | PHP v1 プロダクトの UX 刷新。Place Intelligence OS へ向かう | `docs/strategy/ikimon_renovation_master_plan_2026-04-11.md` |
| **B. Canonical 化** | JSON → SQLite (`ikimon.db`) への段階的移行。証拠の信頼度管理 | `docs/architecture/ADR-001-canonical-source-of-truth.md` |
| **C. v2 全面切替** | Fastify + PostgreSQL の parallel rebuild。cutover / rollback / readiness を含む | `docs/architecture/ikimon_v2_zero_base_cutover_master_plan_2026-04-11.md` |

**重要**: タスクに入る前に「これはどのLayerか?」を確認する。混同すると判断を誤る。

---

## 2. Navigable Biodiversity OS（検索前の分岐）

2026-04-30 時点の追加方針:

**RAGを広く強くする前に、観察データと知識claimを分離し、質問を branch に振り分ける。**

正本入口:

- `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\NAVIGATOR.md`
- `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\branches\*/INDEX.md`
- `docs/spec/navigable_biodiversity_os_contract.md`
- `docs/spec/navigable_biodiversity_os/eval_questions.json`
- `docs/spec/navigable_biodiversity_os/reassess_eval_samples.json`

基本経路:

```
NAVIGATOR
  -> branch INDEX
  -> ObservationPackage
  -> knowledge_claims
  -> focused retrieval
  -> feedback / review / report
```

branch は以下の10個を正準とする。

| branch | 主用途 |
|---|---|
| `observation_quality` | 観察が再利用可能な証拠パッケージか判断 |
| `identification_granularity` | species / genus / species group / unknown の安全な粒度判断 |
| `evidence_tier_review` | AI suggestion / community / expert / Tier 昇格 |
| `knowledge_claims` | 文献claim、citation_span、Hot path 参照条件 |
| `feedback_contract` | AI観察フィードバック、missing evidence、retake guidance |
| `mypage_learning` | 学習履歴、profile digest、再訪・上達ループ |
| `enterprise_reporting` | site report / TNFD / 30by30 / 企業向け出力 |
| `privacy_claim_boundary` | 希少種位置、健康・法務・greenwashing 境界 |
| `freshness_sources` | source_snapshot、versioned facts、curator、cache invalidation |
| `evaluation` | 10問A/B、tokens、unsupported claim、species overclaim |

重要な制約:

- Hot path の `knowledge_claims` は `human_review_status='ready' AND use_in_feedback=TRUE` のみ参照する
- `ObservationPackage` は `visit / occurrences / evidence_assets / identifications / ai_runs / feedback_payload / claim_refs / review_state / report_outputs` を束ねる契約であり、AI出力そのものを正本化しない
- species-level の断定は、観察証拠と review state が支える場合だけ許可する
- 企業レポートや希少種・外来種・健康系の強い主張は claim boundary を通す

---

## 3. 知識OS コンポーネントマップ

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

## 4. Evidence Tier（信頼階層）

```
Tier 1   → AI単独判定（自動）
Tier 1.5 → AI高確信 + 生態学的妥当性チェック（自動昇格）
Tier 2   → コミュニティ検証（1名以上のレビュー）
Tier 3   → 専門家合意（専門家1名 or 一般2名以上）
Tier 4   → 論文・標本等の外部エビデンス紐付き
```

昇格フロー: `ConsensusEngine::evaluate()` → `DataStageManager::promote()`

---

## 5. コンポーネント一覧と実装ファイル

| クラス | ファイル | 役割 | 状態 |
|---|---|---|---|
| `CanonicalStore` | `upload_package/libs/CanonicalStore.php` | SQLite正本 CRUD | ✅ 実装済み |
| `ConsensusEngine` | `upload_package/libs/ConsensusEngine.php` | 同定合意形成 | ✅ 実装済み |
| `DataStageManager` | `upload_package/libs/DataStageManager.php` | ステージ昇格管理 | ✅ 実装済み |
| `CanonicalSync` | `upload_package/libs/CanonicalSync.php` | JSON→DB同期 | ✅ 実装済み |
| `EmbeddingService` | `upload_package/libs/EmbeddingService.php` | Gemini Embedding 2 / 埋め込み生成 | 🔧 開発中 |
| `OmoikaneDB` | `upload_package/libs/OmoikaneDB.php` | 種名・知識検索の SQLite 層 | ✅ 実装済み |
| `AsyncJobMetrics` | `upload_package/libs/AsyncJobMetrics.php` | バックグラウンドジョブ監視 | ✅ 実装済み |
| `SurveyRecommender` | `upload_package/libs/SurveyRecommender.php` | 調査推薦 | ✅ 実装済み |

**注意**:
- この表は「存在する / 入口として重要」なコンポーネントに絞っている
- 実装済みでも、本番正本になっているとは限らない
- `OmoikaneDB` は存在し、複数箇所から参照されている

---

## 6. データフロー（フルパス）

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

## 7. Platform v2（TypeScript側）

```
platform_v2/src/
├── app.ts / server.ts       エントリポイント (Fastify)
├── db.ts                    PostgreSQL接続
├── routes/
│   ├── marketing.ts         トップページ・LP
│   ├── write.ts             観察投稿 API
│   ├── read.ts              観察取得 API
│   ├── health.ts            ヘルスチェック
│   ├── ops.ts               /ops/readiness
│   └── uiKpi.ts             UI KPI events
├── services/
│   ├── authSession.ts       cookie session
│   ├── observationWrite.ts  quick capture / survey write lane
│   ├── observationPackage.ts 実DBから ObservationPackage を組み立てる read helper
│   ├── knowledgeClaimRetrieval.ts branch-aware claim retrieval
│   ├── observationReassess.ts AI観察feedback / user_output_cache / 3レンズgate
│   ├── versionedKnowledgeReader.ts freshness facts -> knowledge_version_set
│   ├── userOutputCache.ts   Hot path 出力cache / version ref invalidation
│   ├── mapEffort.ts         frontier / effort summary / actor lens
│   ├── specialistReview.ts  専門家レビュー
│   ├── visitSubjects.ts     trust lane summary
│   ├── readiness.ts         cutover gate 集約
│   └── writeGuards.ts       write / specialist 権限制御
└── scripts/                 移行スクリプト (import*/verify*)
```

**現状の理解**:
- v2 は `read-only` ではない。staging lane では minimal write lane / photo upload / session lane まで実測済み
- ただし **本番正本はまだ legacy 側**。cutover までは rollback / compatibility を前提に扱う
- `staging /record` は `quick capture` と `survey` を分離し、survey 側で `effort / checklist / scope / revisit reason` を取る方向に入った
- map は `actor lens` を持ち、`local steward / traveler / casual` ごとに frontier を変える入口ができた
- observation detail は `AI suggestion -> community support -> authority-backed -> public claim` を段差つきで見せる
- Navigable Biodiversity OS は `ObservationPackage` 契約、branch INDEX、10問A/B評価、`import:feedback-knowledge`、branch-aware claim retrieval、reassess 出力サンプル生成、reviewer / report への `claim_refs_used` 貫通、CI の `eval:navigable-os` gate まで入っている
- 切替判断は `docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md` と
  `docs/architecture/ikimon_v2_final_cutover_runbook_2026-04-15.md` を参照する

---

## 8. 技術スタック早見表

| 要素 | v1 (現行) | v2 (移行先) |
|---|---|---|
| 言語 | PHP 8.2 | TypeScript (Node.js) |
| Web | Vanilla PHP | Fastify |
| DB | JSON files + SQLite | PostgreSQL + PostGIS |
| Frontend | Alpine.js + Tailwind CDN | Fastify rendered HTML + small inline JS |
| AI | Gemini Flash Lite / Embedding 2 | 同左 |
| Hosting | Xserver VPS (162.43.44.131) | 同左 |

**補足**:
- `Next.js` は cutover 構想文書には現れるが、現 repo の v2 実装は Fastify 中心で進んでいる
- 「構想」と「現実装」を混同しないこと

---

## 9. エージェント作業ガイド

### タスクに入る前の確認

```
1. これは Layer A / B / C のどれか?
2. 既存コンポーネントを使えるか? (上の表を確認)
3. JSON書込 vs DB書込 どちらが正本か? (現状: JSON が本番正本)
4. v1のみ / v2のみ / dual-write か?
5. Navigable OS のどの branch が制御しているか?
```

### いま追加で確認すべきこと

```
6. これは public surface / ops readiness / specialist / deploy のどれか?
7. staging 実測が必要か? それとも doc 更新だけでよいか?
8. security gate（session / specialist role / privileged write API key）に触る変更か?
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

## 10. 参照ドキュメント優先順（ikimon タスク）

1. `docs/IKIMON_KNOWLEDGE_MAP_2026-04-12.md` — 文書の正本索引
2. `docs/IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md` — 現在地と計画
3. **このファイル** (`docs/KNOWLEDGE_OS_OVERVIEW.md`) — 用語と層の入口整理
4. `docs/KNOWLEDGE_OS_BRIDGE_2026-04-14.md` — `.codex/knowledge` と repo docs の橋渡し
5. `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\NAVIGATOR.md` — branch 選択
6. `docs/spec/navigable_biodiversity_os_contract.md` — ObservationPackage / retrieval 契約
7. `docs/architecture/ADR-001-canonical-source-of-truth.md` — Canonical設計
8. `docs/architecture/adr-005-evidence-tier.md` — Evidence Tier仕様
9. `docs/STAGING_RUNBOOK.md` / `docs/DEPLOYMENT.md` — 実行手順

### v2 / cutover を触る場合の追加順

1. `docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md`
2. `docs/architecture/ikimon_v2_final_cutover_runbook_2026-04-15.md`
3. `docs/architecture/ikimon_v2_zero_base_cutover_master_plan_2026-04-11.md`

---

## 11. 蓄積ルール（どのエージェントでも共通）

新知見・変更はどのエージェントからでも以下の形で記録する:

| 種別 | 記録先 |
|---|---|
| アーキテクチャ決定 | `docs/architecture/ADR-NNN-*.md` 新規作成 |
| 実装状況の変化 | このファイルのコンポーネント一覧テーブルを更新 |
| Navigable OS branch変更 | `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\NAVIGATOR.md` と branch `INDEX.md` を更新 |
| バグ・制約発見 | `AGENTS.md` の Critical Patterns に追記 |
| 戦略変更 | `docs/IKIMON_MASTER_STATUS_AND_PLAN_*.md` を更新 |
| エージェント固有メモ | Claude: `~/.claude/projects/.../memory/`、Codex: `~/.codex/knowledge/` |

### overview 保守プロトコル

`docs/KNOWLEDGE_OS_OVERVIEW.md` は「入口」なので、次のどれかが変わったら review 対象とみなす。

- `docs/IKIMON_KNOWLEDGE_MAP_2026-04-12.md`
- `docs/IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md`
- `docs/KNOWLEDGE_OS_BRIDGE_2026-04-14.md`
- `docs/STAGING_RUNBOOK.md`
- `docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md`
- `docs/architecture/ikimon_v2_final_cutover_runbook_2026-04-15.md`
- `platform_v2/src/routes/` と `platform_v2/src/services/` の主要構成

更新フローは固定する。

1. 上の監視対象に変更が入ったら `powershell -ExecutionPolicy Bypass -File .\scripts\check_knowledge_os_overview_sync.ps1` を実行する
2. fail したら overview を更新し、`更新日` と関連節を直す
3. doc-only 変更でも、overview が入口として誤誘導しないかを確認する

**このファイル自体も更新してよい。** ただし更新時は `更新日` と影響節を必ず揃える。

---

## 12. 現時点の注意点（2026-04-30）

- staging の正式 URL は `https://staging.ikimon.life/`
- staging の `/` は v2、`/legacy/` は PHP rollback lane
- v2 には `/ops/readiness` があり、cutover gate は `near_ready / needs_work` で確認する。`near_ready` は rollback safety と audio archive がどちらも成立した時だけ許可する
- cutover 判定では `parityVerified` / `deltaSyncHealthy` / `driftReportHealthy` / `compatibilityWriteWorking` / `audioArchiveReady` / `rollbackSafetyWindowReady` を必ず見る
- rollback 再発防止のため、`trackPoints > 0` と `audioArchiveReady=true` は cutover 前の必須条件にする。`private_uploads` は deploy prepare で `www-data` 所有の永続ディレクトリとして作成する
- v2 write lane には security gate が入っている
  - 一般 write: cookie session の本人のみ
  - specialist: session + specialist role
  - 特権 API (`session issue / user upsert / remember-token issue/revoke`): `V2_PRIVILEGED_WRITE_API_KEY` 必須
- `survey` は比較可能性を高める入口だが、まだ `absence claim` や `trend-ready claim` ではない
- iNaturalist 批判への返答境界は `docs/review/ikimon_inaturalist_critique_response_boundary_2026-04-20.md` を参照する
- `dev_tools/observation_feedback_*` は現 repo には存在しない。今後は `platform_v2/src/scripts/importObservationFeedbackKnowledgeClaims.ts` と `knowledge_claims` を通して復元する

これらを知らずに v2 を触ると、実装・運用・検証のどこかで判断を誤る。
