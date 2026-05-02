# 研究連携戦略 Phase R1-R4

策定日: 2026-04-23
起点: [朝日 GLOBE+ 2026-04-21「ポケモンが原点の生態学者、音で探る自然の再起」](https://globe.asahi.com/article/16509669)
（OIST サムエル・ロス博士 / OKEON 美ら森プロジェクト / Response Diversity Network）

関連正本:
- [`ikimon_public_surface_canonical_pack_2026-04-22.md`](./ikimon_public_surface_canonical_pack_2026-04-22.md) §1.5 trust boundary / §5.2 研究利用 feature
- [`replacement_action_plan_2026-04-23.md`](./replacement_action_plan_2026-04-23.md) Post-cutover TODO の一部

---

## 0. エグゼクティブサマリー

ikimon は市民科学データを研究に流す基盤として **既に 60-70% 完成**:

- `/for-researcher.php`（Darwin Core 準拠、申請制）
- `export_dwca.php`（researcher tier 制御、CC0/CC-BY、RedList 位置秘匿）
- `ApiGate.php`（4-tier: free / researcher 1000req/day / enterprise / government）
- Evidence Tier 1-3+ の信頼レーン
- `specialist_authorities` + `authority_recommendations`（2026-04-23 本番 DB 適用済）
- `passive_event` / `audio_batch_*` / `sound_archive_*`（OKEON 相当のパッシブ音声モニタリング基盤）
- `generate_tnfd_report.php` / `csr_showcase.php`（自然資本 natural capital への橋）

**足りないのは 4 点のみ**。R1-R4 で段階実装する:

1. **R1**: `gbif_publish.php` の mock 解除 + `/for-researcher/apply` 窓口 + `/methodology` 整備
2. **R2**: DOI 発行 / `dataset_versions` / Zenodo 連携
3. **R3**: Response Diversity API（ロス博士の中核概念の operationalization）
4. **R4**: Academic Partnership（OIST MoU、citation tracking、年次 dataset release）

R1-R2 を並行、R3 は R2 後半から重ね、R4 は R2 完了を Gate として開始。合計 14 週、4.2 人月。

---

## 1. Phase 分けの論理

研究者が ikimon を「自分の研究インフラ」と認識するには、以下 4 段階の信頼レベルを順に満たす必要がある。

| レベル | 研究者の問い | 対応 Phase |
|---|---|---|
| L1 入口の透明性 | 「この data はどう作られた？」 | R1 |
| L2 引用可能性 | 「論文で cite できる？」 | R2 |
| L3 独自の科学的価値 | 「ここにしかない切り口は？」 | R3 |
| L4 共同研究関係 | 「継続性は？ 共著できる？」 | R4 |

この順序を崩すと空転する。R3 を先に出しても引用手段（DOI）がなければ論文参考文献に載らず、指標の存在が届かない。

### 各 Phase の Gate 条件（次に進む条件）

| Gate | 条件 |
|---|---|
| R1 → R2 | `gbif_publish.php` UAT 実 POST 成功 1件 / `/for-researcher/apply` 経由の申請 ≥1件 / `/methodology` が canonical pack §1.5 trust boundary を明示 |
| R2 → R3 | Zenodo DOI 1件発行 / `dataset_versions` 稼働 / GBIF 本番 IPT push 成功 / DwC-A に citation 文字列埋込 |
| R3 → R4 | `/api/v1/research/response-diversity` が 2種以上の環境イベント前後差を返す / accuracy 内部評価完了 / researcher tier API key 発行 ≥3件 |
| R4 → 継続運用 | OIST or 同等機関と MoU or データ共有合意 1本 / 引用された preprint/論文 ≥1本 / 年次 release サイクル宣言 |

---

## 2. Phase R1: Foundation Fixes

**期間**: 2週間 (2026-04-23 〜 2026-05-07)
**目的**: 既に 8 割ある research bridge の mock / 欠けを埋め、外部から見て恥ずかしくない基礎状態にする。

### KPI

- `/for-researcher/apply` 申請 ≥3件（2週間で）
- `gbif_publish.php` UAT 実 push 成功 1件
- `/methodology` が canonical pack §1.5 trust boundary と Evidence Tier 1-3+ を明示
- 申請者のうち 1件が researcher tier API key 発行に到達

### 実装タスク

| # | ファイル | 内容 | 見積 |
|---|---|---|---|
| 1 | `upload_package/public_html/api/gbif_publish.php` | mock 解除、`libs/GbifClient.php` 経由で IPT に実 POST。env: `GBIF_IPT_URL` / `GBIF_IPT_USER` / `GBIF_IPT_PASS` | 3d |
| 2 | `upload_package/libs/GbifClient.php` (新) | `publishDwca(string $archivePath, array $eml): array`。`export_dwca.php?format=archive` 成果物を再利用 | 1.5d |
| 3 | `upload_package/public_html/for-researcher/apply.php` (新) | 目的 / 所属 / 希望 tier / データ範囲 / ORCID 欄。`contact_submissions` テーブル再利用 | 1.5d |
| 4 | `upload_package/public_html/methodology.php` | canonical pack §1.5 (AI / 市民 / 専門家 / 研究主張の 4 役割) と Evidence Tier 1-3+ を明示 | 1d |
| 5 | `upload_package/public_html/for-researcher.php` | "data lineage" / "cite as (pending DOI)" セクション追加、apply.php への CTA | 0.5d |
| 6 | `/api/v1/research/occurrences` path 整理 | 現状実装の確認と JSON 固定化 | 1d |

### 依存

- DB migration 不要（R1 範囲内）
- 外部: GBIF IPT アカウント（UAT 無償、prod は publisher 登録必要、並行で申請）

### リスク

- **trust boundary 抵触**: `/for-researcher/apply` で「ikimon data は scientifically validated」と書かない。canonical pack §1.5 「市民記録だけで研究主張が自動成立」は forbidden
- **GBIF 実 push 失敗**: 初回は UAT で慎重に、ROLLBACK 手順（`published_at` を null に戻し GBIF 側で dataset を hidden）を runbook 化
- **enjoy nature 漏洩**: apply CTA を `/` hero から見せない（footer / `/for-researcher` 内のみ）

---

## 3. Phase R2: Research Identity

**期間**: 3週間 (2026-05-08 〜 2026-05-28)
**目的**: ikimon データを論文で cite できる引用単位に昇格させる。DOI 発行と dataset versioning。

### KPI

- 発行 DOI ≥1（pilot dataset v0.1）
- GBIF production push 成功、GBIF.org で検索可能
- `dataset_versions` テーブル稼働、v0 公開
- API response に `dataset_version` / `citation` field
- 研究者からの「cite できる」確認 feedback 1件

### 実装タスク

| # | ファイル | 内容 | 見積 |
|---|---|---|---|
| 1 | `platform_v2/db/migrations/0024_dataset_versions.sql` (新) | `dataset_versions(id, dataset_slug, version, doi, published_at, occurrence_count, license, citation_text, eml_xml, archive_sha256, gbif_dataset_key, zenodo_record_id)` | 0.5d |
| 2 | `upload_package/libs/ZenodoClient.php` (新) | Zenodo REST API (`/api/deposit/depositions`) 薄い wrapper。metadata → file upload → publish 3 ステップ | 2d |
| 3 | `upload_package/public_html/api/v1/research/datasets.php` (新) | GET list versions / GET/{id} metadata + download + citation | 1d |
| 4 | `upload_package/public_html/admin/dataset_release.php` (新) | Admin UI: version tag → EML 編集 → Zenodo publish → DOI 取得 → GBIF publish → insert | 2d |
| 5 | `upload_package/public_html/api/export_dwca.php` | 出力 ZIP 内に `citation.txt` 追加 | 0.5d |
| 6 | `upload_package/libs/Citation.php` (新) | `forDataset($version)` / `forObservation($obs)` → DwC record の `references` / `bibliographicCitation` | 1d |
| 7 | `upload_package/public_html/for-researcher.php` | "How to cite" セクション、最新 version citation 表示 | 0.5d |

### 依存

- **R1 完了**: GBIF client と apply 窓口が動いていること
- 外部: Zenodo アカウント（無償、ORCID 連携推奨）、GBIF prod publisher 権限

### リスク

- **DOI の不可逆性**: Zenodo DOI は publish 後取り消し不可。pilot は v0.1 として small, focused, review 済で出す（例: Evidence Tier 3+ のみ、沖縄 1 地域 100-500 obs）
- **version 整合**: GBIF と Zenodo の version 番号を揃える運用 SOP 必須
- canonical pack §1.5 遵守: citation 文言が「研究主張を自動成立」にならない、factual のみ

---

## 4. Phase R3: Response Diversity API

**期間**: 4週間 (2026-05-22 〜 2026-06-18)
**目的**: ロス博士の中核概念「応答の多様性」を実装、ikimon 独自の科学的価値を可視化。

### KPI

- `/api/v1/research/response-diversity` が 2種以上の環境イベント（台風、寒波、工事など）前後応答差を返す
- researcher tier user ≥1名が可視化 UI 使用
- 精度評価: OKEON 公開データまたは benchmark で誤差推定

### 実装タスク

| # | ファイル | 内容 | 見積 |
|---|---|---|---|
| 1 | `platform_v2/db/migrations/0025_environmental_events.sql` (新) | `environmental_events(id, event_type, start_at, end_at, bbox_geojson, source, severity)`。気象庁 API 取り込み | 1d |
| 2 | `upload_package/libs/ResponseDiversity.php` (新) | mesh × 種 × (before/during/after) 検出率差分、Rao's Q 系多様性指標 | 4d |
| 3 | `upload_package/public_html/api/v1/research/response-diversity.php` (新) | params: `event_id` / `mesh_level` / `taxon_rank`。CC-BY / JSON / researcher tier 必須 | 1.5d |
| 4 | `upload_package/public_html/research/response-diversity.php` (新 deep layer UI) | 応答差の heatmap / time series。hero からリンクしない | 2.5d |
| 5 | `scripts/import_jma_typhoons.php` (新) | 気象庁過去台風を `environmental_events` に定期取り込み | 1d |
| 6 | `docs/methodology/response_diversity.md` (新) | 計算式、制約（mesh 疎で偏る、evidence tier 3+ のみ集計）を明示 | 1d |

### 依存

- **R2 完了**: `dataset_versions` と citation 基盤
- **R1 の `passive_event` / `mesh_aggregates.php`**: 既存流用

### リスク

- **サンプル不足バイアス**: mesh × 種ごとサンプルが少ないと差分が noise → effort-weighted 正規化、N<閾値で NA を返す
- **強い研究主張への滑り**: 応答多様性低 = 保全優先地域、のような政策主張に直結させない。API は指標を返すだけで推論はしない。UI 上も "候補的シグナル" と明示（canonical pack §1.5 準拠）

---

## 5. Phase R4: Academic Partnership

**期間**: 8週間 (2026-06-05 〜 2026-07-31)
**目的**: OIST やアカデミアと formal なパートナーシップを結び、ikimon を Response Diversity Network のノードに位置づける。

### KPI

- OIST or 同等機関と MoU or データ共有合意 1本
- ikimon data 引用 preprint ≥1本
- 年次 dataset release サイクル宣言（例: 毎年 4/22 Earth Day に major version）
- 外部 press / 政策文書参照 ≥1件
- Response Diversity Network メンバー ≥1名が researcher tier API key 使用

### 実装タスク

| # | ファイル | 内容 | 見積 |
|---|---|---|---|
| 1 | `upload_package/public_html/research/partners.php` (新) | 共同研究中機関リスト、publication tracking 公開 UI | 1d |
| 2 | `upload_package/libs/CitationTracker.php` (新) | OpenAlex / CrossRef で ikimon DOI 被引用を定期取得 | 2d |
| 3 | `upload_package/public_html/admin/citation_dashboard.php` (新) | 引用数 / 論文リスト admin UI | 1d |
| 4 | `docs/partnerships/oist_pilot_plan.md` (新) | パイロット研究設計（§8 参照） | 2d |
| 5 | `ops/runbooks/annual_dataset_release.md` (新) | v1.0 切り出し手順、DOI 発行、GBIF push、announcement | 1d |
| 6 | `upload_package/public_html/research/publications.php` (新 public deep layer) | 引用 / 言及論文の読み物風リスト | 1d |

### 依存

- **R2 DOI 基盤**: citation tracking は DOI 前提
- **R3 Response Diversity**: パイロット共同研究テーマは R3 endpoint 使用

### リスク

- **B2B lane との整合**: 研究実績を TNFD / CSR showcase にも流用できるが「enterprise に売る目的で academia を使っている」と見られない運用（research partners は deep layer、`/for-business` hero とは独立）
- **共著・帰属の争い**: 市民観察者の位置づけ（co-author vs acknowledgement）を contributor policy で事前明記

---

## 6. 全体タイムライン（D-Day 起点、週次）

```
Week:      1  2  3  4  5  6  7  8  9 10 11 12 13 14
R1:        ====
R2:           ========
R3:                 ============
R4:                       ==================
```

### マイルストーン

| Week | 到達点 |
|---|---|
| W2 end | GBIF UAT push 成功、`/for-researcher/apply` 公開 |
| W4 end | `/methodology` §1.5 明示、R1 Gate 通過 |
| W5 mid | Zenodo 初 DOI pilot |
| W7 end | GBIF prod publish、dataset v0.1 公開（R2 Gate） |
| W9 end | response-diversity endpoint beta |
| W11 end | OIST 初 cold outreach 反応回収、R3 Gate |
| W14 end | MoU 初稿 or 共同パイロット開始 |

### 並行可能

- R1 #1 (GBIF) と #3 (apply) は独立ファイル、完全並行
- R2 の migration / ZenodoClient / Citation lib は並行開発
- R3 の `environmental_events` import と `ResponseDiversity` lib は並行

### 直列必須

- R2 `admin/dataset_release.php` は ZenodoClient + migration + Citation lib 後
- R3 `response-diversity.php` は `environmental_events` + `ResponseDiversity` lib 後

---

## 7. 必要なリソース

### 開発

| Phase | Engineer | 人月 |
|---|---|---|
| R1 | Backend 1 (PHP) | 0.5 |
| R2 | Backend 1 + DevOps 0.5 (GBIF/Zenodo 認証) | 1.0 |
| R3 | Backend 1 + Data Scientist 0.5 (指標設計) | 1.2 |
| R4 | Backend 0.5 + BizDev 0.5 (OIST outreach, MoU) | 1.5 |
| **合計** | | **4.2 人月** |

### 外部サービス

| サービス | 用途 | 費用 |
|---|---|---|
| Zenodo | DOI 発行 / dataset repo | 無償 |
| GBIF IPT | 生物多様性データ publish | 無償（publisher 登録要） |
| Cloudflare R2 | bulk audio archive download | 月 $5-20（10GB 規模） |
| OpenAlex API | 引用 tracking | 無償 |
| 気象庁過去台風 | `environmental_events` | 無償 |
| ORCID | 研究者 identity | 無償 |

### データ運用

- 専門家 reviewer (`specialist_authorities`): R1 時点 0-3名 → R4 までに 5-10名。金銭報酬なしから開始（co-author 記載 + 年次 dataset 共著記載 + 対面イベント招待の公共財モデル）
- 年次 dataset release: 年 1 回 2-3 人日の review

### 提携

- **primary**: OIST（ロス博士）— 沖縄地点、音声モニタリング、Response Diversity Network
- **secondary**（同時に打診可）: 国立科学博物館、森林総研、地方大学生態学研究室（北海道大、京都大、琉球大）
- **長期**: 環境省 自然環境局（policy）、TNFD Japan（B2B pivot）

---

## 8. OIST / ロス博士 接触案

### 8.1 ルート選定

| ルート | 確度 | 速度 |
|---|---|---|
| 朝日 GLOBE+ 記者経由の warm intro | 高 | 中（数週間） |
| OIST コミュニケーション office への cold mail | 中 | 速い（数日） |
| 日本生態学会 / 保全生態学研究会 経由 | 中 | 遅い |
| Response Diversity Network 公開連絡先 | 低-中 | 中 |

**推奨**: (a) GLOBE+ 記者に 1 通送って intro 依頼 + (b) OIST 公式 cold mail 並行。先に反応した方を main channel に。

### 8.2 初回に送るもの（3点セット）

1. **1枚 pitch PDF**
   - Headline: 「ikimon は市民音声記録を research-grade にラダーアップする citizen-science bridge」
   - 1段落: OKEON と同じ発想を、全国の市民ネットワーク側から補完
   - 3 bullets: (i) evidence tier 2名合意、(ii) Darwin Core / DOI publish、(iii) response diversity 指標 API
   - 末尾: 「研究利用無償、共同研究歓迎、音声データ tier 別アクセス提供可」

2. **API live demo**
   - `/for-researcher.php` link
   - `curl` で `/api/v1/research/occurrences?taxon=ウグイス&format=json` サンプル
   - R2 後なら `/api/v1/research/datasets` の DOI 付き response sample

3. **サンプル dataset（small, specific）**
   - 沖縄本島 Evidence Tier 3+ 観察 100件の DwC-A zip（R2 で DOI 付き）
   - EML で著作権 / lineage / limitation 明示
   - R3 後: `response_diversity_sample.json` 追加

### 8.3 最初のメール文案骨子

> 件名: 「citizen science → research bridge」ikimon からの共同研究相談
>
> サム様
>
> 朝日 GLOBE+ の記事を拝見し、OKEON の音声モニタリングと Response Diversity Network の取り組みに深く共鳴しました。弊社 ikimon は、日本全国の市民観察者から集めた（音声含む）生物観察を、Darwin Core / GBIF / DOI 付き dataset として研究利用可能な形にする citizen-science bridge を運営しています。
>
> 先生の課題である「共通言語の欠如」「24地点を全国化する」観点で、ikimon 側の市民記録と OKEON の精密音声モニタリングを接続できるのではと考えています。添付 pitch / API demo / サンプル DwC-A をご覧ください。30分オンラインミーティングをいただけると幸いです。

### 8.4 OIST からの最小「Yes」の引き出し方

- **いきなり MoU ではなく**「ikimon pilot dataset v0.1 を OKEON 側で read-only 検証」だけの無負担提案からスタート
- 反応が良ければ R4 で共同 preprint 企画 → MoU 交渉

---

## 9. canonical pack 制約遵守チェック

| 制約 | 本計画での扱い |
|---|---|
| canonical pack §1.5 trust boundary | R1 `/methodology` 更新、R3 の caveats 明示、全 API response に `confidence` / `evidence_tier` field 維持 |
| enjoy nature を壊さない | R1-R4 の全 UI は deep layer (`/for-researcher`, `/research/*`) に集約、`/` hero とトップナビに出さない |
| 段階リリース | 1 Phase 完遂だけでも value、いずれも負債にならない設計 |
| B2B / TNFD との整合 | R4 citation tracker は TNFD / CSR report にも流用可（「当社が参照した ikimon dataset v2.0 DOI:xxx」） |

canonical pack §1.5 遵守は R1 と R3 の両方で個別に記述した通り、API response / UI コピー / methodology page の 3 面で担保する。

---

## 10. 未決事項

- **Zenodo vs Figshare vs 自社 DOI minter** 最終選定（推奨: Zenodo、理由: 生態学コミュニティ採用率）
- **researcher tier API key 発行の審査基準**（ORCID 必須 / 所属機関 required / 目的記述など）
- **音声 bulk zip download のストレージ plan**（R2-R3 で必要、Cloudflare R2 想定で概算済）
- **市民観察者への「研究利用されました」通知文言**（notification UI 既存、文言未）

---

## 11. 参照ファイル（実装時クリティカル）

| ファイル | 役割 |
|---|---|
| `upload_package/public_html/api/gbif_publish.php` | R1 mock 解除対象 |
| `upload_package/public_html/api/export_dwca.php` | R2 citation 差込 |
| `upload_package/libs/ApiGate.php` | R1-R4 全体の tier 認証基盤 |
| `upload_package/public_html/for-researcher.php` | R1-R4 で段階更新 |
| `docs/strategy/ikimon_public_surface_canonical_pack_2026-04-22.md` | trust boundary 正本（§1.5 / §5.2） |
| `platform_v2/db/migrations/` | R2=0024, R3=0025 追加 |
| `upload_package/public_html/api/v2/mesh_aggregates.php` | R3 で流用 |
| `upload_package/public_html/api/v2/passive_event.php` | R3 応答指標の入力 |

---

## 改訂履歴

| date | author | change |
|---|---|---|
| 2026-04-23 | 愛 (Claude) | 初版。朝日 GLOBE+ 2026-04-21 OIST ロス博士記事を起点に Phase R1-R4 設計。基盤 60-70% 既存、残 4項目を 14週 4.2人月で埋める計画 |
