# ikimon.life Biodiversity Freshness OS 仕様書

更新日: 2026-04-29
正本パス: `docs/spec/ikimon_biodiversity_freshness_os_spec.md`
関連: `docs/spec/ikimon_long_term_observatory_data_principles_2026-04-11.md` (5 層観測原則), `db/migrations/0033_observation_feedback_knowledge_claims.sql` (既存 knowledge_claims), CLAUDE plan `C:\Users\YAMAKI\.claude\plans\ikimon-life-ai-https-platform-claude-co-majestic-clarke.md`

---

## 0. 目的

ikimon.life の保守を「AI を真実の保管庫にせず、versioned data を主役にし、AI を更新発見・差分説明・ユーザー変換の係に限定する」設計で再構築する。これにより:

- 数万ユーザー規模で 1 ユーザー月 100 円未満の AI コスト
- 外来種法令・レッドリスト・分類体系・衛星・論文の自動鮮度維持
- 過去時点の AI 出力を遡及再現できる監査性
- ベータ依存・モデル廃止・コスト超過に対する自動劣化耐性

5 層観測原則 (Taxon / Evidence / Effort / Site Condition / Time Series) は本仕様の前提条件。Freshness OS は **Layer 1 (Taxon)** と **Layer 4 (Site Condition)** の鮮度維持を主担当する。

---

## 1. 用語定義

| 用語 | 定義 |
|---|---|
| **source_snapshot** | 外部一次資料の生取得物。URL / 取得時刻 / sha256 / license / etag を持つ。改変不可 |
| **version (`*_versions` テーブル)** | snapshot から派生した正規化済み事実。`valid_from / valid_to` で時点管理。新事実は INSERT、既存行は UPDATE しない |
| **claim** | 既存 `knowledge_claims`。AI prompt 注入用 ikimon-authored paraphrase。260 字以内、citation_span 320 字以内 |
| **registry_key** | freshness_registry の主キー。データソース単位で「いつ取得すべきか」「誰が取りに行くか」を管理 |
| **curator_run** | Node curator dispatcher の 1 回の実行。source fetch / snapshot / validator / SQL 生成 / receiver POST を Node が持ち、LLM は構造化抽出だけに使う |
| **cache_key** | user_output_cache の主キー。`prompt_version + user_id + visit_id + asset_blob_ids + digest_version + knowledge_version_set` の sha256 |
| **knowledge_version_set** | 1 つの AI 出力が参照した version_id 群の JSON。invalidate 判定の根拠 |

---

## 2. アーキテクチャ

### 2.1 データフロー

```
[Authoritative Sources]
GBIF / ChecklistBank / IUCN / GRIIS / 環境省 / MHLW / 論文 (OpenAlex/CrossRef/J-STAGE)
STAC衛星 (国交省/NASA/Microsoft Planetary Computer) / ユーザー観察
                          ↓
[Source Adapter 層]
   - source_snapshots に raw を保存 (改変不可)
   - freshness_registry の next_due_at をスケジュール
   - 失敗時 consecutive_failures++ → staleness_alerts
                          ↓
[Versioned Biodiversity Knowledge Store]
   invasive_status_versions / risk_status_versions / taxonomy_versions / taxon_name_mappings
   place_environment_snapshots / effort_metrics
   全テーブルが source_snapshot_id FK + valid_from/valid_to を持つ
                          ↓
[Node Curator Dispatcher] (Gemini 3.1 Flash-Lite Preview default)
   source fetch / snapshot detection / structured extraction / deterministic validation / SQL proposal
   出力 telemetry は ai_curator_runs に格納、proposal SQL は receiver POST
   knowledge_claims への提案は claim_review_queue 経由
                          ↓
[Evaluation & Human Review Gate]
   GitHub PR (`agent-generated` ラベル) で人手承認
   自動拒否: §3.2 信頼境界違反
                          ↓
[Personalized Output Layer] (Hot path = Gemini 3.1 Flash Lite Preview)
   user_output_cache (cache_key で hit 判定)
   miss 時のみ Flash Lite 呼出 → ai_cost_log に記録
   curator が新 version を INSERT すると影響 cache_key を invalidate
```

### 2.2 3 層責務

| 層 | 起動 | 主モデル | レイテンシ目標 | 主な書込先 |
|---|---|---|---|---|
| **Hot** | HTTP req | Gemini 3.1 Flash Lite Preview | P95 1.5s | `user_output_cache`, `observation_ai_assessments`, `ai_cost_log` |
| **Warm** | systemd timer + webhook | Gemini 3.1 Flash-Lite Preview (DeepSeek V4 Flash failover where allowed) | 数分〜数十分 | `source_snapshots`, `*_versions` (PR経由), `ai_curator_runs`, `claim_review_queue` |
| **Cold** | systemd timer + queue | Gemini Flex (50%割引) | 非同期 | `audio_*`, `sound_clusters`, `tile_regen_queue`, `ai_cost_log` |

---

## 3. 不変条件 (絶対遵守)

### 3.1 AI 出力の不可変原則

1. **versioned data は UPDATE しない**。新事実は INSERT、旧版は `valid_to` で閉じる
2. **AI は版を作らない**。version 行の作成は curator_run 経由 + PR 承認のみ
3. **Hot 層は cache_key で読む**。`knowledge_version_set` が変わらない限り再生成しない
4. **過去の AI 出力は遡及再現可能**。`occurred_at` 時点で `valid_from <= t < COALESCE(valid_to, now())` の version を引ける

### 3.2 信頼境界 (§1.5 準拠)

既存 `knowledge_claims` の制約を尊重:

- `claim_text` 1〜260 字 (既存 CHECK)
- `citation_span` ≤ 320 字 (既存 CHECK)
- `access_policy` ∈ {`metadata_only`, `open_abstract`, `oa_license_verified`, `licensed_excerpt`} (既存 CHECK)
- `source_excerpt` (新規 `*_versions` 側) は 600 字までを上限とするが、Hot prompt 注入時は 320 字に切る
- Hot 層に流れるのは `human_review_status='ready' AND use_in_feedback=TRUE` のみ
- 自動承認可能な claim は `claim_type ∈ {seasonality, habitat, distribution, identification_trait, missing_evidence}` かつ `risk_lane='normal'` のみ
- `risk_lane ∈ {invasive, rare}` は人手承認必須、危険種位置情報は `taxon_precision_policy` の policy_id 経由で必ず精度ぼかし

違反検出時:
- DB CHECK 制約で書込拒否
- アプリ層 assertion で 2 重ガード
- ai_curator_runs に違反記録 + 当該 curator 自動停止

### 3.3 コスト不変条件

- `aiCostLogger.log()` を呼ばない LLM 呼出禁止 (アプリ層 assertion)
- `aiBudgetGate.assertAllowed(layer)` を経由しない LLM 呼出禁止
- 月予算 80/95/99% で自動劣化 (§7.2)

### 3.4 鮮度不変条件

- すべてのデータソースは `freshness_registry` に登録済であること
- 「いつ取得したか分からない」状態のデータを `*_versions` に入れない
- `consecutive_failures >= 3` の registry_key は status='critical' で Slack 通知

---

## 4. 中核テーブル設計

詳細 DDL は migration ファイル `0041_*` 〜 `0051_*` を正本とする。本節は責務と関係を述べる。

### 4.1 source_snapshots
全 curator が「これを見て判断した」根拠を残す台帳。`(source_kind, content_sha256)` で一意 (同内容を再保存しない)。

### 4.2 freshness_registry
データソース単位の運用状態。`expected_freshness_days` を超えると `status='stale'`、`consecutive_failures >= 3` で `status='critical'`。

| registry_key 例 | source_kind | 頻度 | trust |
|---|---|---|---|
| `mhlw_invasive_national` | mhlw_invasive | 7 | A |
| `iucn_japan` | iucn_redlist | 30 | A |
| `env_redlist_jp` | env_redlist_pdf | 90 | A |
| `gbif_backbone` | gbif_backbone | 30 | A |
| `openalex_daily` | openalex | 1 | B |
| `crossref_daily` | crossref | 1 | B |
| `jstage_weekly` | jstage | 7 | B |
| `mlit_landuse_mesh` | stac_landuse | 30 | A |
| `nasa_impervious` | stac_impervious | 30 | A |

### 4.3 *_versions テーブル

すべて以下の共通カラムを持つ:
- `version_id UUID PK`
- `source_snapshot_id UUID FK NOT NULL`
- `valid_from DATE NOT NULL`
- `valid_to DATE NULL` (NULL = 現在有効)
- `superseded_by UUID FK NULL`
- `curator_run_id UUID FK NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

固有カラム:
- **invasive_status_versions**: `scientific_name`, `gbif_usage_key`, `region_scope`, `mhlw_category`, `designation_basis`, `source_excerpt (≤600)`
- **risk_status_versions**: `scientific_name`, `region_scope`, `redlist_authority` (iucn|env_jp|prefecture), `redlist_category` (CR|EN|VU|NT|LC|DD|NE|EX), `assessed_year`, `source_excerpt (≤600)`
- **taxonomy_versions**: `gbif_usage_key`, `scientific_name`, `taxon_rank`, `parent_usage_key`, `accepted_usage_key`, `taxonomic_status`, `kingdom..species`, `backbone_version`
- **taxon_name_mappings**: `scientific_name_canonical`, `name_variant`, `name_kind` (vernacular_jp|synonym|misspelling|legacy), `language`, `confidence`
- **place_environment_snapshots**: `place_id`, `metric_kind` (impervious_pct|forest_pct|water_pct|landuse_class), `metric_value`, `tile_z/x/y`, `observed_on`

Hot 層は常に `WHERE valid_to IS NULL` で読む (現在有効版だけ)。
過去再現は `WHERE valid_from <= :t AND (valid_to IS NULL OR valid_to > :t)`。

### 4.4 ai_curator_runs
Node curator dispatcher 実行ログ。`curator_model_provider / curator_model_name / curator_model_call_count / gemini_call_count / rows_proposed / rows_dropped_validation` でモデル利用と deterministic validation 結果を追跡し、`pr_url` で人手承認を追跡。

### 4.5 claim_review_queue
`knowledge_claims` の `human_review_status` 遷移を queue 化。`severity ∈ {low, normal, high, critical}` で SLA を分ける (critical は 24h 以内)。

### 4.6 staleness_alerts
`freshness_registry.consecutive_failures >= 3` または `next_due_at < NOW() - INTERVAL '7 days'` で起票。Slack 通知 + ダッシュボード掲示。

### 4.7 user_output_cache
Hot 層キャッシュ。`knowledge_version_set JSONB` に「この出力が参照した version_id 群」を保存。

invalidate ルール:
- 新 version INSERT 時: 該当 `scientific_name` または `place_id` を含む cache_key を `expires_at = NOW()` で閉じる
- prompt_version bump 時: 該当 prompt の全 cache_key を閉じる
- 5 分毎の `runCacheInvalidate.ts` でバッチ処理

### 4.8 ai_cost_log
LLM 呼出ごと 1 行。`layer / endpoint / provider / model / tokens / cost / user_id / visit_id / agent_run_id / escalated / cache_hit / metadata`。

集計クエリは `aiCostLogger.summarizeMonth(layer)` を経由 (集計ロジック散在防止)。

---

## 5. Hot 層仕様

### 5.1 観察評価 (`observation_reassess`)

呼出経路: `observationReassess.ts:639` で `runGemini` 直前に以下を順実行:

1. `aiBudgetGate.assertAllowed('hot')` (予算チェック)
2. `loadProfileDigestForPrompt(userId)` で 240 字以内の summary 取得
3. `latestKnowledgeVersionSet({ scientific_names, place_id })` で関連 version_id 群を確定
4. cache_key 計算 → `fetchUserOutputCache(cache_key)` で hit 判定
5. miss → Flash Lite 呼出 → `aiCostLogger.log({...})` → `saveUserOutputCache(cache_key, payload)`

### 5.2 prompt v3 改修

`platform_v2/src/prompts/observation_reassess.md` v3:
- 入力情報セクションに `観察者プロファイル: ${profileDigestSummary}` 追加
- narrative トーン制御に「profileDigestSummary が示す関心領域があれば 1 文だけ触れる、断定/個人特定は禁止」追記
- バージョン文字列を `prompt_version='observation_reassess/v3'` で明示 (cache_key 構成要素)

### 5.3 Pro エスカレーション条件

`runGemini` 内で Flash Lite 1 次推論後に判定:

| 条件 | アクション |
|---|---|
| `confidence_band='low' AND novelty_hint.score >= 0.5` | Pro 1 回再呼出 |
| `invasive_response.is_invasive=true AND mhlw_category IN ('iaspecified','priority')` | Pro 強制 |
| ユーザー UI 「もっと詳しく」 | Pro |
| `aiBudgetGate.currentMonthRatio() >= 0.80` | エスカレーション全停止 |

`escalated=true` で `ai_cost_log` に記録、月内エスカレーション率 5% 上限を `aiBudgetGate.assertEscalationAllowed()` で強制。

### 5.4 月 1 万円試算

仮定: Gemini 3.1 Flash-Lite Preview $0.25/M 入力 / $1.50/M 出力、150 円/USD。1 req = 入力 4k + 出力 1.2k ≈ **0.42 円/req**。

| シナリオ | req/月 | 備考 |
|---|---|---|
| cache 0% | 23,800 | 理論最大 |
| cache 50% (現実値想定) | 47,600 | profile_digest 不変前提 |
| Pro 5% 混在 | 19,000 | 安全係数込み |

DAU 100、1 ユーザー 5 観察/日 = 月 15,000 観察 → 安全マージン 4 倍。検証フェーズには十分。

---

## 6. Warm 層仕様

### 6.1 4 curator

| curator | 頻度 | source_kind | 出力 version table |
|---|---|---|---|
| invasive-law | 週次月曜 03:00 JST + webhook | mhlw_invasive | invasive_status_versions |
| redlist | 毎月 1 日 03:30 | iucn_redlist + env_redlist_pdf | risk_status_versions |
| paper-research | 毎日 03:45 | openalex + crossref + jstage | knowledge_claims (use_in_feedback=false) |
| satellite-update | 毎月 5 日 04:00 | stac_landuse + stac_impervious | place_environment_snapshots |

### 6.2 共通フロー

1. `freshness_registry` の `next_due_at` を読み実行判定
2. 外部 fetch → `source_snapshots` INSERT (etag/last_mod で差分判定、内容同じなら snapshot 作らない)
3. Node workflow が Gemini/DeepSeek を temperature 0 の構造化抽出だけに使用
4. deterministic validator が必須項目、enum、excerpt 長、secret 混入、重複 current row 誘発 SQL を拒否
5. Node が `source_snapshots` CTE を先頭に含む migration SQL を生成し、receiver へ POST
6. receiver が GitHub branch / migration / PR を作成し `agent-generated` ラベル付与
7. 人手承認 → CI が migration として apply
8. `freshness_registry.last_success_at = NOW(), consecutive_failures = 0` を更新

### 6.3 ikimon-db-mcp 権限

`platform_v2/mcp_servers/ikimon-db-mcp/permissions.json`:

```json
{
  "invasive-law": {
    "read":  ["invasive_status_versions", "taxa_gbif_cache", "freshness_registry", "source_snapshots"],
    "write_proposal": ["invasive_status_versions", "source_snapshots"],
    "write_direct":   ["freshness_registry", "ai_curator_runs"]
  },
  "redlist": {
    "read":  ["risk_status_versions", "taxa_gbif_cache", "knowledge_claims", "freshness_registry"],
    "write_proposal": ["risk_status_versions", "source_snapshots", "knowledge_claims"],
    "write_direct":   ["freshness_registry", "ai_curator_runs"]
  },
  "paper-research": {
    "read":  ["knowledge_sources", "knowledge_claims", "freshness_registry", "source_snapshots"],
    "write_proposal": ["knowledge_sources", "knowledge_claims", "source_snapshots"],
    "write_direct":   ["freshness_registry", "ai_curator_runs", "claim_review_queue"],
    "constraints": { "knowledge_claims.use_in_feedback": false, "knowledge_claims.human_review_status": "pending" }
  },
  "satellite-update": {
    "read":  ["place_environment_snapshots", "plot_monitoring", "freshness_registry"],
    "write_proposal": ["place_environment_snapshots", "source_snapshots"],
    "write_direct":   ["freshness_registry", "ai_curator_runs", "tile_regen_queue"]
  }
}
```

`write_direct` は CI を介さない自動承認。`write_proposal` は GitHub PR 必須。

---

## 7. 横串

### 7.1 Evaluation Gate (6 指標)

`/admin/data-health` (新規 SSR ルート) に常時可視化:

| 指標 | 計算元 | 目標 | アラート |
|---|---|---|---|
| 出典付き率 | `claims_used_in_feedback / total` (cache に出現した claim) | ≥ 95% | < 90% で yellow |
| 古い claim 混入率 | `valid_to IS NOT NULL` の参照率 (cache_key invalidate 漏れ検出) | ≤ 1% | > 3% で red |
| 地域不一致率 | `region_scope != observation_region` 参照率 | ≤ 2% | > 5% で red |
| 危険種位置漏洩件数 | `iaspecified` 種 × public lat/lng > 精度policy閾値 | 0 件絶対 | 1 件で critical |
| レビュー待ち件数 | `claim_review_queue WHERE decision IS NULL AND severity='critical' AND created_at < NOW()-24h` | 0 件 | 1 件で yellow |
| 1 ユーザー月 AI コスト | `ai_cost_log GROUP BY user_id, month` の P95 | < 100 円/MAU | > 200 円で yellow |

### 7.2 自動劣化ロジック

`aiBudgetGate.ts` が `ai_cost_log` 集計から判定:

| 月予算ラタイオ | 状態 | アクション |
|---|---|---|
| < 80% | normal | 制限なし |
| 80% 〜 95% | constrained | Pro エスカレーション全停止、Slack 警告 |
| 95% 〜 99% | strict | Hot 層 Flash Lite 固定、Warm 層 dry-run 化 |
| 99% 〜 100% | freeze | Hot 層 cache hit のみ返却、miss は graceful 拒否 |
| > 100% | reject | ai_cost_log 書込時拒否、manual override (env `AI_BUDGET_OVERRIDE=1`) で再開 |

### 7.3 Cold 層 systemd timer

`platform_v2/ops/systemd/`:
- `ikimon-cold-audio-cluster.{service,timer}` 毎時
- `ikimon-cold-audio-embedding.{service,timer}` 15 分毎 (Flex tier)
- `ikimon-cold-cache-invalidate.{service,timer}` 5 分毎
- `ikimon-warm-curator-{invasive,redlist,paper,satellite}.{service,timer}` 各上記頻度

エントリ: `node dist/scripts/cron/{runAudioCluster,runAudioEmbedding,runCacheInvalidate,runCurator}.js`

---

## 8. Sprint ロードマップ (2026-04-28 実装後の現況)

### Sprint 0 ✅ (PR #184)
- `docs/spec/ikimon_biodiversity_freshness_os_spec.md` 作成
- 既存制約 (`knowledge_claims` 260/320 字, `access_policy` 4 値) との整合確認

### Sprint 1 ✅ (PR #184) — 基盤
- migration: `0045_source_snapshots`, `0046_freshness_registry`, `0047_ai_curator_runs`, `0048_ai_cost_log`
- service: `aiCostLogger.ts`, `aiBudgetGate.ts`
- staging 適用済 (4 テーブル + 10 件 freshness_registry seed)

### Sprint 2 ✅ (PR #185) — Versioned Knowledge Store + Hot wiring + Dashboard
- migration: `0049_knowledge_claims_compat` (cross-branch FK 用) + `0050_invasive_status_versions` 〜 `0058_inferred_absence_candidates` (合計 10 本)
- service: `userOutputCache.ts` (CRUD + cache key + invalidation API)
- 改修: `observationReassess.ts` の `runGemini` に budget gate + cost log を配線、layer/endpoint/provider/model/tokens/cost/escalated/cache_hit を ai_cost_log に記録
- 新規ルート: `routes/adminDataHealth.ts` (Evaluation Gate ダッシュボード — 月次AIコスト×3 layer + freshness_registry + claim_review_queue + staleness_alerts)
- staging 適用済

### Sprint 3 ✅ (PR #186) — Personalization + pgvector + Cold cron skeleton
- migration: `0059_knowledge_claims_embedding` (pgvector 1536d, ivfflat lists=50), `0060_research_paper_ingest_queue`
- service: `profileDigestPromptLoader.ts` (≤240 字 summary, profile_note_digests 由来)
- 改修: `observation_reassess.md` v3 + `taxon_insight.md` で `${profileDigestSummary}` placeholder 追加、`observationReassess.ts` で digest 取得 → renderPrompt
- cron: `src/scripts/cron/runCacheInvalidate.ts` (gc + freshness_registry status refresh + overdue alert 起票) + systemd unit `ikimon-cold-cache-invalidate.{service,timer}` (運用者手動 enable)
- staging 適用済

### Sprint 4 ✅ (PR #187) — MCP server + Curators + GitHub Action
- `platform_v2/mcp_servers/ikimon-db-mcp/` (README + permissions.json + server.ts スケルトン)
  - tools: `query_readonly`, `propose_write`, `schema_introspect`, `record_run_status`, `register_snapshot`
  - 信頼境界 §1.5 制約は code で強制 (knowledge_claims の use_in_feedback / 長さ制約)
- 4 curator system prompts: `mcp_servers/curators/{invasive-law,redlist,paper-research,satellite-update}-curator.md`
- `.github/workflows/agent-curator-pr.yml` — proposal SQL → 自動 PR 化 + `agent-generated` ラベル

### Sprint 5 ✅ (PR #188) — Cache 統合 + 旧 CMA 本走起動経路
- service: `versionedKnowledgeReader.ts` (invasive / redlist / taxonomy / place_env の current/time-travel lookup + buildKnowledgeVersionSet)
- 改修: `observationReassess.ts` で cache fetch → hit 時 ai_cost_log に cache_hit=true 記録 + 既存 ReassessResult 復元、miss 時末尾で saveUserOutputCache
- 新規: `src/scripts/cron/runCurator.ts` — 当時は Anthropic Managed Agents HTTP client。Sprint 7 で Node dispatcher に置換済み
- 新規 systemd unit: `ikimon-warm-curator-{invasive,redlist,paper,satellite}.{service,timer}` (週次 / 月次 1日 / 日次 / 月次 5日)
- 旧必要 env: `ANTHROPIC_API_KEY`, `ANTHROPIC_CMA_AGENT_<NAME>_ID`。現在の curator runtime では不要

### Sprint 7 ✅ — Node-owned Curator + Gemini/DeepSeek bakeoff 基盤
- `src/scripts/cron/runCurator.ts` を Node dispatcher 化。CMA / Sonnet / DeepSeek-key-in-agent 経路を廃止
- `invasive-law` は Node が source snapshot → Gemini/DeepSeek structured extraction → validator → snapshot-backed SQL → receiver POST まで実行
- `redlist` / `paper-research` / `satellite-update` は `cancelled/not_migrated` で exit 0
- `curatorModelBakeoff.ts` + `npm run test:curator` で Gemini 3.1 Flash-Lite Preview と DeepSeek V4 Flash の fixture bakeoff 判定を固定
- `Gemini 2.5 Flash-Lite` は curator fallback から除外

### Sprint 8+ (将来)
- `taxon_precision_policy` × 危険種位置遮断の Hot-path 統合 (claim 取得時に precision policy 適用)
- Cache hit ratio 監視ダッシュボード強化 (現在は /admin/data-health に call_count + cache_hit のみ)
- Green pool 同期の自動化 (現状は次の deploy で blue↔green インバート)

---

## 9. リスクと撤退条件

| リスク | 検出シグナル | 撤退アクション |
|---|---|---|
| Gemini/DeepSeek API 5xx | curator 連続 3 回失敗 | 同一モデル retry → provider failover。`Gemini 2.5 Flash-Lite` には落とさない |
| 月予算超過 | ai_cost_log 集計 > 8000 円 | §7.2 自動降格 → Slack → UI に「AI 機能負荷調整中」バッジ |
| 信頼境界 §1.5 違反 | claim_text/citation_span 長さ違反、access_policy 範囲外 | DB CHECK + アプリ assertion で書込拒否 + 当該 curator 自動停止 |
| Flash Lite Preview 廃止 | 5xx 連続 | 既存 `observationReassess.ts:440-468` フォールバックを Pro → DeepSeek → 静的 cache の順で拡張 |
| Xserver VPS リソース枯渇 | systemd OOM | curator chunk size / timer cadence を落とす。audio embedding batch_size を ENV 化 |
| Versioning による DB 肥大 | テーブル行数 > 100M | `valid_to IS NOT NULL` 行を月次で `*_versions_archive` に移動 (パーティション化) |
| user_output_cache invalidate 漏れ | 古い claim 混入率 > 3% | runCacheInvalidate を 1 分毎に変更 + scientific_name index 強化 |

---

## 10. 検証手順 (E2E)

### Hot 層
- `/observations/:id` を 100 req 流して P95 計測 (`playwright.staging.config.ts` 流用)
- 期待: P95 < 1.5s、`ai_cost_log` の 1 req コスト 0.42 円 ± 30%、cache hit ratio ≥ 50%

### Warm 層
- 各 curator を `--dry-run` 起動 → `out/proposals/*.sql` 目視
- diff があれば手動 PR 化 → CI green 確認
- redlist-curator: IUCN API モック (fixture) でローカル完走

### Cold 層
- `systemctl start ikimon-cold-audio-cluster.timer` 即時実行
- `sound_clusters` 行数増加 + `ai_cost_log` に `layer='cold'` 出現
- 失敗注入 (Gemini 401) → Slack 通知到達確認

### Evaluation Gate
- `/admin/data-health` で 6 指標カード + コストゲージ + curator status 表示
- 月予算 80% を `ai_cost_log` 手動 INSERT で偽装 → エスカレーション拒否確認
- versioning 遡及テスト: 過去 occurred_at の version 引き当てが正しい

---

## 11. 既存資産の再利用方針

| 既存 | 再利用方針 |
|---|---|
| `knowledge_claims` (`0033_*`) | 拡張 (claim_embedding 列追加、constraint は既存維持)。新規 `*_versions` の citation_span は別カラムで持つ |
| `knowledge_sources` (`0033_*`) | paper-research-curator が直接書込先として利用 |
| `profile_note_digests` (`0030_*`) | Hot 層 prompt 注入に再利用。新規生成不要 |
| `audioCluster.ts`, `audioEmbedding.ts` | Cold 層 cron entry に薄く wrap |
| `observationFeedbackKnowledge.ts` | claim_embedding semantic fallback を Sprint 3 で追加 |
| `gbifBackboneMatch.ts` | taxonomy-update-curator (Sprint 4) で活用 |
| `observation_ai_assessments` (`0016_*`) | Hot 層出力の永続化先 (user_output_cache とは別役割: cache=高速読、assessments=正本) |
| `taxon_precision_policy` (`0022_*`) | 危険種位置情報遮断の基盤 |
| `0021_official_notice_cache.sql` | source_snapshots パターンの先行例として参考 |

---

## 12. 絶対原則 (実装中の道標、再掲)

1. **AI を真実の保管庫にしない**。すべての知識は versioned DB が持ち、AI は更新発見・差分説明・ユーザー変換の係
2. **ユーザー常駐エージェント禁止**。Hot 層はステートレス + cache。state は DB が持つ
3. **DB 直書き禁止 (curator)**。すべて claim_review_queue → PR ルート (write_proposal カラム経由)
4. **信頼境界 §1.5 厳守**。claim_text ≤ 260 字、citation_span ≤ 320 字、access_policy ホワイトリスト、危険種位置情報は taxon_precision_policy 経由
5. **コスト集計を最初に作る**。aiCostLogger を経由しない LLM 呼出禁止
6. **freshness_registry に登録しないデータソース禁止**。「いつ取得したか分からない」状態を作らない
7. **5 層観測原則と整合**。Layer 1 (Taxon) と Layer 4 (Site Condition) の鮮度維持を Freshness OS が主担当
