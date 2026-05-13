# ikimon.life Monitoring-ready Data Infrastructure Review

作成日: 2026-05-14  
対象: ikimon.life current runtime (`platform_v2/`)  
結論: 分類群別機能を増やす前に、`monitoring record contract v0` を固定する。

## 0. Executive Summary

BioMonWeek 2026 の録画差分と現行実装を照合すると、ikimon.life の方向性は正しい。すでに `visit / occurrence / evidence / identification`、水辺拡張、AI候補、レビュー、権利、Darwin Core CSV v0、site evidence report の足場がある。

ただし、現状は「足場が複数箇所に存在する」段階で、分類群横断の共通契約としてはまだ弱い。今すぐやるべきことは、新画面や分類群別アプリ化ではなく、既存足場を束ねる `monitoring record contract v0` を文書・型・APIレスポンスで固定すること。

推奨する最小契約は次の 6 つ。

1. `record_core`
2. `method_extension`
3. `effort_denominator`
4. `verification_state`
5. `ai_provenance`
6. `data_rights_export_readiness`

この契約があれば、画像投稿、動画、ガイド調査、フィールドスキャン、釣果、水辺、音声、eDNA、リモセン参照を、別々のプロダクトではなく同じ monitoring data infrastructure の method variation として扱える。

## 1. Evidence Reviewed

### 1.1 Local Required Sources

| Source | Status | Note |
|---|---:|---|
| `E:/Projects/ikimon-internal/docs/research/biomonweek_2026_youtube_transcript_delta_2026-05-14.md` | Read | YouTube 自動字幕由来の差分。設計シグナルとして扱う |
| `C:/Users/YAMAKI/.codex/knowledge/ikimon_biodiversity_os/artifacts/notes/biomonweek_2026_monitoring_design_signal.md` | Read | `observation_method`, `verification_state`, `ai_provenance`, `effort` 優先の判断 |
| `C:/Users/YAMAKI/.codex/knowledge/ikimon_biodiversity_os/artifacts/notes/biomonweek_2026_youtube_transcript_delta.md` | Read | opening/community/TERN/harmonisation/SCANS の要約 |
| `E:/Projects/ikimon-internal/docs/CATCHUP_GUIDE.md` | Read | 古い PHP 入口より current runtime を優先すべきことを確認 |
| `E:/Projects/ikimon-internal/docs/IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md` | Read | place-first / long-term observatory の長期方針 |
| `E:/Projects/ikimon-internal/docs/spec/ikimon_scene_observation_record_vocabulary_2026-05-11.md` | Missing | 指定パスには存在しない |
| `docs/spec/ikimon_scene_observation_record_vocabulary_2026-05-11.md` | Used instead | 現行 repo 側の同名ファイルを代替正本として使用 |

### 1.2 Current Runtime Sources

| Area | Evidence |
|---|---|
| Core model | `platform_v2/db/migrations/0001_extensions_and_core.sql` |
| Monitoring package foundation | `platform_v2/db/migrations/0099_monitoring_package_foundation.sql` |
| Method context / sensor / eDNA | `platform_v2/db/migrations/0101_site_based_monitoring_os.sql` |
| Visual AI evidence | `platform_v2/db/migrations/0102_visual_evidence_extracts_and_vertex_ai.sql` |
| AI review | `platform_v2/db/migrations/0103_observation_record_ai_reviews.sql` |
| Observation package | `platform_v2/src/services/observationPackage.ts` |
| Data product chain / method context | `platform_v2/src/services/observationPackageDataChain.ts` |
| Monitoring readiness | `platform_v2/src/services/monitoringReadiness.ts` |
| Monitoring package standard | `platform_v2/src/services/monitoringPackageStandard.ts` |
| Data rights | `platform_v2/src/services/observationDataRights.ts` |
| Research export | `platform_v2/src/services/researchExport.ts`, `platform_v2/src/routes/researchApi.ts` |
| Site evidence report | `platform_v2/src/services/siteEvidenceReport.ts` |

### 1.3 Official External Confirmation

外部情報は公式系だけを補助参照した。BioMonWeek 2026 は monitoring community、standardisation、governance、new technologies、citizen science、data use を中心テーマにしており、ローカル資料の「投稿SNSではなく monitoring-ready infrastructure へ寄せる」判断と整合する。

- BioMonWeek official: <https://2026.biomonweek.eu/>
- Biodiversa+ Day 1 highlights: <https://www.biodiversa.eu/2026/05/04/biomonweek2026-highlights/>
- GBIF event page: <https://www.gbif.org/event/3ioWg1a0c3OaUuYQAR9RPb/biomonweek-2026>

## 2. Current State

### 2.1 Current / Legacy / Planned

| Layer | Status | 判断 |
|---|---|---|
| Current runtime | `platform_v2/` の Node.js / PostgreSQL runtime | 通常作業の正本。今回の評価対象 |
| Legacy PHP | `upload_package/` | 互換・ rollback ・永続データ境界。通常機能の判断入口にしない |
| Internal strategy docs | `ikimon-internal` と Knowledge OS | 方針と設計シグナル。実装済み判定は current code で確認する |
| Planned / future | DwC-A, JBIF/OBIS/S-Net, full campaign/protocol admin | 方向性は妥当だが、v0 では出口を塞がない契約までに留める |

### 2.2 What Already Exists

| Capability | Current implementation | 判定 |
|---|---|---|
| Scene / visit | `visits`, `ObservationPackageVisit` | 土台あり |
| Observation record | `occurrences`, `ObservationPackageOccurrence` | 土台あり |
| Media / evidence | `evidence_assets`, `asset_blobs`, media role migrations | 土台あり |
| Identification history | `identifications`, `specialistReview.ts`, `reviewerAuthorities.ts` | 土台あり |
| Method context | `observation_method_contexts`, `ObservationMethodContext` | 部分あり |
| Water / catch / no-catch | `water_record_extensions`, `waterRecordExtension.ts` | 部分あり。`no_catch` と `absent` を分けている点は良い |
| AI provenance | `observation_ai_runs`, `observation_ai_assessments`, `visual_*`, `observation_record_ai_reviews` | 部分あり。保存はあるが共通表示契約が弱い |
| Review / verification | `evidence_tier`, quality reviews, specialist review, AI agree/disagree | 部分あり。語彙統一が必要 |
| Export readiness | `observation_data_rights`, `researchExport.ts`, Darwin Core CSV v0 | 部分あり |
| Site report | `siteEvidenceReport.ts`, `placeSnapshot.ts` | 土台あり。claim boundary が明確 |
| Event / campaign-like flow | `observation_event_*`, event capsules | 部分あり。monitoring campaign entity としては未完成 |

## 3. Gap Analysis

### 3.1 Core Design Gap Table

| Core design | Present | Weak / missing | Required next contract |
|---|---|---|---|
| Record Core | `visits`, `occurrences`, `evidence_assets`, `identifications`, scene/record vocabulary | `data_provider_type`, `data_use_context`, `license`, `sensitive_data_policy` が散在。`subject` と `taxon_candidate` の契約が UI/API で一貫しない | `record_core` を API/package 上で必ず出す |
| Method Extension | `ObservationMethodContext`, `observation_method_contexts`, `field_scan_contexts`, `water_record_extensions`, passive audio | casual photo / video / guide / field scan / identification / sensor / eDNA / remote sensing の vocabulary が完全には揃っていない | `observation_method` controlled vocabulary と `method_metadata` envelope を固定 |
| Effort / Absence / Denominator | `effort_minutes`, `distance_meters`, `complete_checklist_flag`, event absences, `no_catch` | `observer_count`, `duration`, `area`, `repeat_visit`, `denominator_context`, `data_gap_reason` が共通契約に未統合 | `effort_denominator` を method-independent に持つ |
| Verification | evidence tier, quality review, specialist review, AI agree/disagree, reviewer scope | `unverified / ai_suggested / community_reviewed / expert_verified / rejected / needs_more_evidence / sensitive_hidden` の統一語彙がない | `verification_state` を display と machine の両方で固定 |
| AI Provenance | AI run, assessment, visual extracts, subject candidates, AI review | `count_estimate`, `cover_estimate`, `bbox_or_region`, `human_override`, `ai_label_visibility` が共通形で見えない | `ai_provenance[]` を人間入力から分離 |
| Campaign / Protocol | observation events, sessions, quests, absences, capsules | `monitoring_campaign`, `synchronized_survey`, `protocol`, `review_policy`, `aggregation_rule` の entity が弱い | v0 では `protocol_profile` と `campaign_context` を package に載せる |
| Aggregation / Export | Darwin Core CSV v0, export QA, site evidence report | DwC-A / Darwin Core Data Package / JBIF / OBIS / S-Net は未実運用。`aggregation_level`, `trend_claim_level`, `workflow_version` が散在 | raw / summary / indicator / export package の stage と claim level を固定 |

### 3.2 Common Foundation Before Taxon-specific Features

先に作るべき共通基盤:

| Foundation | Why |
|---|---|
| `observation_method` | 分類群別でなく、方法別に比較可能性が決まる |
| `method_metadata` | 同じ写真でも casual と protocol survey は意味が違う |
| `effort_denominator` | trend / abundance / non-detection の条件 |
| `verification_state` | AI候補、市民合意、専門家確認、棄却を混ぜない |
| `ai_provenance` | AI推定を人間入力や expert label に混ぜない |
| `data_rights_export_readiness` | 外部公開、研究利用、企業報告、同意撤回を分ける |
| `trend_claim_level` | raw occurrence と政策・企業報告値を混ぜない |

後で分類群別に足せばよいもの:

| Later extension | Examples |
|---|---|
| Bird checklist | heard/seen, breeding code, complete checklist |
| Plant phenology | flower/fruit, cultivated/wild, cover |
| Fungi voucher | substrate, host, underside photo, specimen/DNA |
| Pollinator transect | timed count, weather, flower association |
| Water / fishing | CPUE, gear, release/kept, tidal/water conditions |
| eDNA | primer, lab, negative control, bioinformatics pipeline |
| Camera trap | trap nights, blank images, deployment |
| Remote sensing | external layer reference, raster product, processing version |

## 4. Recommended Direction

### 4.1 Best Option

`monitoring record contract v0` を current runtime の正本として固定する。

狙い:

- すべての観察導線を `scene -> observation record -> package -> reviewed data -> report/export` へ整理する。
- casual observation と protocol survey は UI では近く見せても、data contract では必ず区別する。
- AI は候補・抽出・推定・下書き・異常検知の補助層に置き、確定・公開粒度引き上げ・外部提出・政策/企業報告値は人間または reviewer に残す。
- Darwin Core CSV v0 を起点に、DwC-A / Darwin Core Data Package / JBIF / OBIS / S-Net へ拡張できるようにする。

採用条件:

- 投稿体験の初期負荷を増やしすぎない。
- ただし、後から埋められない `method`, `time`, `place`, `evidence`, `rights`, `AI provenance` は失わない。
- report/export へ進むほど required fields を増やす。

### 4.2 Second-best Option

既存の `ObservationPackage` と `MonitoringReadiness` に、doc-level の `monitoring record contract v0` を重ねる。DB migration は後回しにして、API response と QA report で不足を可視化する。

採用理由:

- 実装負荷が小さい。
- 既存の `monitoringPackageStandard.ts`, `monitoringReadiness.ts`, `researchExport.ts` を活かせる。
- 後で migration を入れるときに、何を正規化すべきかが決まっている。

今回の推奨は second-best から入ること。まず契約を固定し、次の1週間で最小コード差分へ進める。

## 5. Recommended Schema Contract

これは今回の実装ではなく、次の実装単位に渡す TypeScript-friendly contract である。

```ts
type MonitoringRecordContractV0 = {
  schema_version: "monitoring_record_contract/v0";
  record_core: {
    record_id: string;
    scene_id: string;
    subject: {
      subject_id: string;
      subject_role: "primary" | "coexisting" | "background" | "trace" | "habitat" | "unknown";
      taxon_candidate: {
        scientific_name: string | null;
        vernacular_name: string | null;
        taxon_rank: string | null;
        external_taxon_ids: Record<string, string | number>;
      } | null;
    };
    location: {
      internal_precision: "exact" | "coarse" | "unknown";
      public_precision: "hidden" | "mesh" | "municipality" | "watershed" | "site_summary" | "exact_private";
      coordinate_uncertainty_m: number | null;
      location_source: "gps" | "exif" | "manual" | "derived" | "masked" | "unknown";
    };
    observed_at: string;
    media_refs: string[];
    observer: {
      observer_id: string | null;
      observer_role: "citizen" | "expert" | "municipality" | "company" | "sensor" | "project" | "unknown";
    };
    site_context: Record<string, unknown>;
    data_provider_type: "citizen" | "expert" | "municipality" | "company" | "sensor" | "project" | "legacy" | "unknown";
    data_use_context: "learning" | "site_management" | "research" | "policy_reporting" | "corporate_disclosure" | "public_story" | "unknown";
    license: {
      dataset_license: "CC0-1.0" | "CC-BY-4.0" | null;
      media_license: "all_rights_reserved" | "CC-BY-4.0" | "CC-BY-NC-4.0" | null;
    };
    sensitive_data_policy: {
      risk_lane: "normal" | "rare_sensitive" | "invasive" | "private_land" | "fishing_spot" | "minor_or_voice" | "unknown";
      system_public_precision_cap: string;
      information_withheld: string[];
    };
  };
  method_extension: {
    observation_method:
      | "casual_photo"
      | "video"
      | "guided_survey"
      | "field_scan"
      | "identification"
      | "fishing"
      | "transect"
      | "point_count"
      | "sensor"
      | "edna"
      | "remote_sensing_reference";
    method_metadata: Record<string, unknown>;
    equipment: Record<string, unknown>;
    route: Record<string, unknown> | null;
    survey_area: Record<string, unknown> | null;
    sampling_frequency: string | null;
    sampling_protocol_id: string | null;
  };
  effort_denominator: {
    observer_count: number | null;
    duration_seconds: number | null;
    distance_meters: number | null;
    area_square_meters: number | null;
    repeat_visit: boolean;
    no_detection: boolean;
    no_catch: boolean;
    data_gap_reason: string | null;
    denominator_context: Record<string, unknown>;
  };
  verification_state: {
    state:
      | "unverified"
      | "ai_suggested"
      | "community_reviewed"
      | "expert_verified"
      | "rejected"
      | "needs_more_evidence"
      | "sensitive_hidden";
    evidence_tier: number | null;
    community_agreement: Record<string, unknown>;
    expert_review: Record<string, unknown> | null;
    reviewer_scope: Record<string, unknown> | null;
  };
  ai_provenance: Array<{
    ai_model: string;
    ai_model_version: string | null;
    run_at: string;
    species_candidates: Array<Record<string, unknown>>;
    confidence: number | null;
    count_estimate: number | null;
    cover_estimate: number | null;
    bbox_or_region: Record<string, unknown> | null;
    evidence_used: string[];
    human_override: Record<string, unknown> | null;
    ai_label_visibility: "hidden" | "candidate_badge" | "assistive_note" | "reviewer_only";
  }>;
  protocol_campaign: {
    monitoring_campaign_id: string | null;
    synchronized_survey: boolean;
    target_taxa: string[];
    target_area: Record<string, unknown> | null;
    protocol_id: string | null;
    review_policy: string | null;
    required_evidence: string[];
    campaign_period: { start: string; end: string } | null;
    aggregation_rule: string | null;
  };
  aggregation_export: {
    aggregation_level: "raw_observation" | "site_summary" | "grid_summary" | "watershed_summary" | "campaign_summary" | "ebv_like_indicator";
    trend_claim_level: "anecdotal" | "occurrence" | "occupancy_hint" | "abundance_estimate" | "trend_estimate";
    workflow_version: string;
    derived_product_version: string | null;
    export_readiness: Record<string, unknown>;
  };
};
```

## 6. UI / UX Role Design

### 6.1 User Action Matrix

| User action | Primary role | Overlap | Missing / weak role | Monitoring handling |
|---|---|---|---|---|
| 画像投稿 | 低摩擦の scene capture。出現・証拠・学習の入口 | AI候補、同定、field scan と重なる | method が casual なのか protocol なのか UI/API で曖昧になりやすい | default は `casual_photo`; trend claim は `anecdotal` または `occurrence` まで |
| 動画投稿 | 行動・動き・文脈を残す。静止画で不足する証拠を補う | 画像、field scan、AI visual extract と重なる | key frame、証拠領域、長尺メディア保持方針が弱い | `video` method。AI抽出は `ai_provenance`、正式同定は reviewer/human |
| ガイド機能での調査 | 初学者を導きながら effort / route / non-detection を残す | 画像、field scan、campaign と重なる | protocol survey と casual guide の境界が弱い | `guided_survey`; effort が揃えば monitoring-ready 候補 |
| フィールドスキャン | 場所状態・定点・経路・面の記録 | ガイド、remote sensing、site report と重なる | fixed point / route / area の public UI と export contract がまだ薄い | `field_scan`; repeatable anchor がある場合だけ indicator candidate |
| 同定 | observation record を育てる。AI候補や市民候補を reviewable にする | 投稿、AI、専門家レビューと重なる | community agreement と expert verification の表示が混ざりやすい | `identification`; verification state を更新するが、method/effort とは分ける |

### 6.2 Status Label Design

UI では、次のラベルを同じ色・同じ意味で使う。確定語は expert/trusted review 以外で使わない。

| Label | Meaning | Allowed source |
|---|---|---|
| `AI推定` | AIが候補・数・被度・証拠領域を出した | `ai_provenance`; human label ではない |
| `未確認` | まだ人の確認がない | default state |
| `コミュニティ確認` | 複数人の合意または scoped community support | community agreement。expert verified ではない |
| `専門家確認` | scoped reviewer / expert validator が確認 | reviewer scope と rationale 必須 |
| `要追加証拠` | 写真・音声・部位・場所・努力量が不足 | reviewer or AI assist |
| `秘匿中` | 希少種、私有地、釣り場、未成年/人声など | system risk cap / admin / site policy |
| `却下` | 誤同定・証拠不足・非生物など | review rationale 必須 |

## 7. AI / Human Responsibility Boundary

| Task | AI can do | Human required | Expert / scoped reviewer required |
|---|---|---|---|
| Species candidates | 候補、類似種、根拠、追加撮影指示 | 採用/保留/却下 | 希少種、分布外、政策・研究・企業報告 |
| Count / cover estimate | 個体数・被度・bbox候補を推定 | 採用・補正・無効化 | 報告値や indicator に使う場合 |
| Evidence extraction | 証拠領域、key frame、画質不足を抽出 | 公開証拠への採用 | high-risk media / privacy risk |
| Input assist | method/effort/location metadata の補完候補 | 保存前確認 | protocol / campaign record |
| Queue triage | risk lane、review priority、missing evidence queue | queue 操作の監査 | high-risk escalation |
| Report draft | site summary や review request の下書き | 公開・送信・外部提出 | 企業報告、行政・研究提出 |
| Trend / abundance | 不足条件の検出、解析候補提示 | claim 採用判断 | trend/abundance estimate の承認 |

禁止:

- AIだけで希少種、外来種、政策指標、企業報告値を確定する。
- AI推定値を人間入力の count / cover / identification と同じ column 意味で保存する。
- 通過中の guide 非検出を `confirmed_absence` として扱う。

## 8. Migration / Compatibility Plan

### 8.1 No breaking change

既存 `visits`, `occurrences`, `evidence_assets`, `identifications` は維持する。legacy PHP の `upload_package/` は互換・永続データ境界として触らない。

### 8.2 Additive contract first

最初は DB migration ではなく、`ObservationPackage` / research API / QA report に `monitoring_record_contract/v0` projection を追加する。既存データは不足項目を `null`, `unknown`, `not_recorded` として明示する。

### 8.3 Backfill strategy

| Source | Backfill |
|---|---|
| existing `visits` | observed_at, effort_minutes, distance_meters, complete_checklist_flag, target_taxa_scope |
| existing `occurrences` | taxon candidate, evidence tier, AI status, occurrence status |
| existing `evidence_assets` | media refs, evidence used |
| `observation_data_rights` | license / consent / withdrawal |
| `civic_observation_contexts` | public precision / risk lane / report consent |
| `water_record_extensions` | no_catch / capture outcome / waterbody |
| `observation_method_contexts` | method / protocol / sampling effort |

### 8.4 Later normalization

契約が安定したら、次の additive migration を検討する。

- `monitoring_record_contract_snapshots`
- `monitoring_campaigns`
- `sampling_protocol_profiles`
- `ai_provenance_events`
- `verification_state_events`
- `derived_products`

## 9. Implementation Steps

### 9.1 Next 1 week minimum

1. `MonitoringRecordContractV0` の doc/type を追加する。
2. `ObservationPackage` に contract projection を追加する。
3. `/api/v1/research/occurrences` または package API に `verification_state`, `method_extension`, `ai_provenance`, `export_readiness` を明示する。
4. `researchExport` の QA report に `missing_method`, `missing_verification_state`, `ai_only_unreviewed`, `missing_effort_denominator` を blocker として追加する。
5. UI の status label vocabulary を `AI推定 / 未確認 / コミュニティ確認 / 専門家確認 / 要追加証拠 / 秘匿中 / 却下` に寄せる。

### 9.2 Medium term

1. `monitoring_campaigns` と `sampling_protocol_profiles` を追加する。
2. event/campaign から synchronized survey を組めるようにする。
3. site evidence report に `aggregation_level` と `trend_claim_level` を表示する。
4. Darwin Core CSV v0 を `event.csv`, `occurrence.csv`, `multimedia.csv`, `metadata.json`, `qa_report.json` へ分離する。

### 9.3 Long term

1. DwC-A / Darwin Core Data Package を作る。
2. JBIF / GBIF / OBIS / S-Net 連携候補の dataset governance を定義する。
3. external export は license, withdrawal, masked location, reviewer verification が揃った record のみに限定する。
4. EBV-like indicator は raw observation から直接作らず、derived product として version 管理する。

## 10. Test and Verification Plan

| Area | Test scenario |
|---|---|
| Contract projection | existing visit/occurrence から `monitoring_record_contract/v0` が生成され、不足項目が `unknown/null` で明示される |
| Casual vs protocol | casual photo は trend claim にならず、guided survey / field scan の effort ありだけ indicator candidate へ進む |
| AI provenance | AI候補、bbox、count/cover 推定が human identification と混ざらない |
| Verification | community agreement と expert verification が別状態として出る |
| No-catch / absence | `no_catch` が occurrence absent に変換されない |
| Sensitive policy | rare/private/fishing spot/minor/voice が public precision cap を上げられない |
| Export QA | license, withdrawal, location generalization, review, method, effort の blocker が出る |
| Research export | Darwin Core CSV v0 は export-ready record だけを出す |
| Site report | report は `activity indicator` と `trend estimate` を混同しない |
| Legacy compatibility | `upload_package/data/**` や config/secrets を変更しない |

Doc-only の今回作業では `npm --prefix platform_v2 run typecheck` は必須ではない。次に TypeScript を触る時点で実行する。

## 11. Risks and Operations

| Risk / operation | Required design |
|---|---|
| Data deletion / withdrawal | `withdrawal_status`, tombstone, downstream export invalidation |
| Retention | media type / user type / site policy ごとの retention |
| Offline / field operation | offline draft, sync state, location accuracy warning |
| Large media | resumable upload, key frames, derivatives, original retention policy |
| Location / date uncertainty | coordinate uncertainty, location source, date/time uncertainty |
| Audit log | review, AI adoption, public precision, export, admin access |
| AI model evaluation | model version, eval set, false positive/negative, regression |
| Notification fatigue | severity, digest, frequency cap, quiet hours |
| Community health | report/moderation, no volume-only ranking, reviewer scope |
| Multilingual / accessibility | short status labels, accessible badges/forms, plain Japanese |
| Cost management | AI task budget, media tiering, high-cost batch boundary |
| Security | upload validation, EXIF policy, RBAC, signed URL, rate limit |
| Legal / disclaimer | no edible advice, no legal permission advice, no conservation outcome guarantee |
| Metrics | review_ready_rate, monitoring_ready_rate, export_ready_rate, revisit_rate, review turnaround |

## 12. Open Questions

| Question | Default for now |
|---|---|
| `verification_state` を DB column 化するか projection に留めるか | projection first |
| `monitoring_campaign` entity を event system に統合するか別 table にするか | separate entity, event can reference it |
| 外部 export の初期 license default | external export off by default; explicit CC BY 4.0 or CC0 only |
| expert verification の最低条件 | scoped reviewer trust model を採用し、scope/rationale を必須にする |
| AI count/cover estimate の採用先 | first reviewer-only / report draft only, public claim には使わない |
| DwC-A の開始時期 | CSV v0 + QA report が安定してから |

## 13. Answers to Required Questions

### 13.1 今すぐ直すべき仕組みは何か

`verification_state` と `ai_provenance` の表示・API契約を直す。AI候補、未確認、コミュニティ確認、専門家確認、要追加証拠、秘匿中を同じ vocabulary で出し、AI推定を human/expert label と混ぜない。

次点で `method_extension` と `effort_denominator` を `ObservationPackage` から常に読めるようにする。

### 13.2 後でよいが、今からデータ項目だけは持つべきものは何か

次は今から持つべき。

- `observation_method`
- `sampling_protocol_id`
- `method_metadata`
- `observer_count`
- `duration_seconds`
- `distance_meters`
- `area_square_meters`
- `repeat_visit`
- `no_detection`
- `no_catch`
- `denominator_context`
- `verification_state`
- `ai_model`, `ai_model_version`, `run_at`, `evidence_used`
- `count_estimate`, `cover_estimate`, `bbox_or_region`
- `data_provider_type`
- `data_use_context`
- `license`
- `sensitive_data_policy`
- `aggregation_level`
- `trend_claim_level`
- `workflow_version`

### 13.3 やると危険なことは何か

- casual observation から「増えた/減った」を言うこと。
- AI候補を専門家確認と同じ表示にすること。
- `no_catch` と biological absence を混同すること。
- 生データと企業・行政向け集計値を同じ record として扱うこと。
- 希少種、釣り場、私有地、子ども/人声の公開粒度を user preference だけで上げられるようにすること。
- 分類群別UIを先に作り、方法・努力量・検証・権利の共通契約を後回しにすること。

### 13.4 ikimon.life が他の観察アプリや釣りアプリと違う価値は何か

ikimon.life の価値は、写真投稿数や釣果共有ではなく、地域の scene を monitoring-ready package に育てることにある。

他アプリとの差分:

- casual な発見を、method / effort / verification / rights つきの record に育てられる。
- AIを確定者ではなく、証拠抽出・候補生成・不足検出・下書きに使う。
- 釣果、水辺、音声、定点、ガイド、field scan を同じ method variation として扱える。
- 自然共生サイト、学校、自治体、企業、研究者が同じ基盤上で違う権限・粒度・出力を持てる。
- raw observation と report-ready aggregate を分けるため、過剰な自然改善 claim を避けられる。

### 13.5 次の1週間で実装するなら、最小の実装単位は何か

最小単位は `MonitoringRecordContractV0 projection`。

実装範囲:

1. `src/services/monitoringRecordContract.ts` を追加する。
2. `ObservationPackage` から `record_core`, `method_extension`, `effort_denominator`, `verification_state`, `ai_provenance`, `aggregation_export` を組み立てる。
3. package API または research API に contract を返す option を追加する。
4. QA report に不足 blocker を追加する。
5. unit test で casual photo / guide survey / water no_catch / AI-only / expert verified の 5 ケースを固定する。

これなら DB を壊さず、投稿体験も変えず、次の migration と UI 改修の判断基準を作れる。

## 14. Final Recommendation

今の ikimon.life は、すでに monitoring-ready infrastructure へ進める素材を持っている。弱いのは部品数ではなく、共通契約である。

次の1週間は分類群別の新機能に行かず、`MonitoringRecordContractV0` を current runtime の中で projection として実装するのが最も堅い。これが入ると、鳥・植物・菌類・釣果・水辺・音声・eDNA・企業サイトを、ばらばらの機能ではなく同じデータ基盤の variation として扱える。
