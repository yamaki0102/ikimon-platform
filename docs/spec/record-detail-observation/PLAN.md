# PLAN — Record / Observation migration

## 1. Plan status

本書は実装順、migration、verification、rollbackの正本です。

active PR、現在フェーズ、blocker、deploy状態は`yamaki0102/all-projects-management`を正本とし、本書へ時系列で複製しません。

2026-07-23の表示修正では、既存のobservation-first基盤を変更せず、通常閲覧面をmedia-firstへ切り替えます。DB migration、backfill、新規AI呼び出し、monitoring schema変更はこの表示修正へ含めません。

## 2. Preconditions

実装開始前に次を監査します。

- 現行record / visit / occurrence / AI candidate / media schema
- current write paths
- current record detail read paths
- multi-subject、coexisting taxa、visual rescueの既存実装
- community identificationとcurator state
- public location protection surfaces
- environment assessmentとmonitoringの既存境界
- PostgreSQL / D1 / materialized read modelの現行責務
- active branches / PRs / migrations / dirty worktrees

監査結果は`confirmed / inferred / unknown`に分け、未確認のphysical nameを仕様へ固定しません。

## 3. Migration sequence

```text
expand
→ dual-write
→ backfill
→ shadow-read
→ cutover
→ contract
```

各段階は独立PRとし、前段のverification evidenceを次段の開始条件にします。

## 4. Proposed PR sequence

### PR-A — Contract and inventory

Scope:

- 本SPEC / ADR / PLAN
- current schema / route / service inventory
- mapping table: current entity → target entity
- data classification
- metrics baseline
- no runtime behavior change

Exit:

- 曖昧なentity責務が一覧化
- target contractとのconflictが分類済み
- migrationとrollback対象が確定

### PR0 — Common public location protection

Scope:

- record / observation detail、feed、search、map、API、OGP、JSON-LD、cache、media metadata、monitoring/exportの位置情報surface inventory
- record/observation単位のpublic responseとURLからcoordinates、cell、mesh、geohash、private geometry、exact place locatorを除去する共通policy
- owner exact-location responseをauthenticated private `no-store` laneへ限定
- rare/sensitive species、home、school、minors、private landの回帰test

Rules:

- observation migrationと独立に先行できる
- UIだけを隠してAPI、HTML attribute、structured data、cache、URLへ残さない
- public display policyとresearch export policyを混同しない
- public mapは別のaggregate contractとし、k-anonymity・sensitive suppression・coarse geometryを満たす集約cellだけを許可する。単一recordのcellをdetail/API/URLへ戻さない

Exit:

- protected exact location leakage = 0 on the enumerated public surfaces
- owner-only exact path has authentication, authorization and cache-control tests

### PR-B — Expand schema

Additive only:

- `record_observations`
- `record_observation_policies`
- `record_observation_source_map`
- `record_observation_media`
- `observation_ai_suggestions`
- `observation_identification_claims`
- `observation_lifecycle_events`
- `occurrence_projection_versions`
- `environment_assessments`
- `environment_assessment_media`
- `record_observation_consistency_ledger`
- `identification_queue_entries`

Rules:

- existing columns / tablesを削除・renameしない
- current readers / writersを壊さない
- migrationはfresh DB、backup restore、stagingで検証してからremote apply候補にする
- production migrationはroutine deployと分離した固定名command/profileで、承認済みexact SHAにだけ適用する

Exit:

- old runtime green
- new empty structures readable
- rollback is code/config disable, not destructive downgrade

### PR-C — Dual-write and async AI provisional observations

Scope:

- record save後のAI job enqueue
- idempotent AI analysis run
- multi-subject detection result
- provisional observation作成
- observation-media links
- identification candidates
- old write and new write consistency ledger

Rules:

- user saveはAI完了を待たない
- AI failureはrecord save failureにしない
- replayで重複observationを増やさない
- AIだけでhuman_asserted / accepted / verified / active occurrenceへ遷移しない

Exit:

- exact input replayがidempotent
- AI-created observations are always `ai / provisional / unreviewed / active / personal_only`
- old write path remains compatible

### PR-D — Backfill

Scope:

- existing record / occurrence / subject-like dataをobservation modelへ変換
- provenance、source IDs、rule version
- ambiguous records quarantine / needs-review
- pet / captive / group / unknown mapping

Rules:

- 曖昧なsubject境界を推測でhuman_asserted化しない
- destructive rewriteをしない
- batch cursor、resume、checksum、dry-run、diff reportを持つ

Exit:

- row / relation counts explained
- orphan and ambiguous counts classified
- rerun is safe
- rollback retains old source data

### PR-E — Shadow-read

Scope:

- record detail新read modelをshadowで生成
- old / new response comparison
- difference reason codes
- performance、privacy、missing relation metrics

Required comparisons:

- observation count
- media association
- accepted identification
- occurrence eligibility
- public precision
- community activity
- AI / human provenance
- environment assessment

Exit:

- unexplained P0 / P1 differences = 0
- location privacy regressions = 0
- latency / error budget within agreed threshold

### PR-F — Record detail and community UX cutover

Scope:

- record containerと写真・動画・音を主役にした通常閲覧面
- 0..N observationsを初期表示では1枚へまとめるobservation summary
- multi-observation edit / split / merge / exclude
- media reassignment
- AI provisional state
- community identification without recruitment action
- record-level proposal policy for public / limited / private
- community-added provisional subjects
- automatically ranked identification queue
- pet / unknown / group presentation

Rules:

- record mediaはobservation card内へ分散せず、record単位で重複なく表示する
- observationの管理状態と全操作は通常閲覧へ展開せず、「詳しい編集」配下へ置く
- AI候補、環境情報、学習情報はデータ状態の説明より自然への気づきと学びを優先し、存在する保存データだけを表示する
- observation 0件ではobservation sectionそのものを表示せず、通常の写真・動画・音の記録として成立させる
- observation複数では最大3件をsummaryに出し、全件は利用者操作後に表示する
- 「みんなに聞く」「名前の提案を募集中」「人の確認待ち」「みんなの確認はまだありません」「確認0件」および同義の募集状態は追加しない
- 提案0件の専用empty stateを表示しない
- AIをcommunity票に含めない
- owner / AI / community / curator provenanceを混同しない
- no-JS / accessibility / mobile statesを確認

Exit:

- 0 / 1 / N observationsのUIが成立
- mobile first viewでmediaがtitle・summary・管理操作より先に表示される
- 同一record mediaがobservationごとに重複表示されない
- user can correct AI split / merge
- public community identification works by policy
- public/limited default ON、private owner-only、record-level OFFがAPIとUIで一致する
- community-added subject remains provisional and creates no occurrence
- queue ordering is independent from proposal recruitment state
- accessibility and visual QA pass

### PR-G — Occurrence projection and research gate

Scope:

- human_asserted observation + accepted identificationからoccurrence projection
- active / inactive projection
- projection version / provenance
- rights / evidence / privacy / quality gates
- research-use eligibility separated from public display

Exit:

- AI-only source cannot create active occurrence
- source change reprojects deterministically
- revoked / corrected source updates projection
- export has explicit consent and precision policy

### PR-H — Environment and monitoring separation

Scope:

- provisional environment assessment
- external / sensor / human source distinction
- monitoring series aggregation contract
- suppression, consent, missing data, provenance
- public area / monitoring location protection
- `monitoring_projection_versions`による再生成可能な集約version

Exit:

- one AI result cannot overwrite main monitoring
- aggregation sources and rule versions are traceable
- public surfaces share the same protection policy

### PR-I — Contract cleanup

Scope:

- old occurrence-as-subject write responsibilities disabled
- deprecated readers / flags removed only after rollback window
- old docs marked superseded
- final schema / route / export docs

Rules:

- source data and audit history are retained
- contract cleanup does not combine unrelated legacy removal
- deletion / destructive migration requires separate approval
- contract開始条件は14日間の安定観測、代表100 records以上のold/new比較、unexplained P0/P1差分0、位置漏洩0

Exit:

- current runtime uses observation-first contract
- old path usage metrics = 0 for agreed window
- rollback / recovery documentation verified

## 5. Verification matrix

### Static

- typecheck
- unit / integration tests
- schema and migration validation
- JSON / link validation
- secret and local-path scan
- obsolete contract search

### Data

- fresh DB migration
- representative restored backup migration
- dry-run backfill
- idempotent rerun
- relation and orphan counts
- ambiguous quarantine

### Behavior

- record with no identifiable organism
- one subject / one media
- one subject / multiple media
- multiple subjects / one media
- multiple subjects / multiple media
- AI adds provisional subject
- user rejects / merges / splits AI subject
- pet / captive
- group with estimated count
- unknown individual
- community identification without recruitment
- public / limited / private / proposal-policy-OFF permission matrix
- community adds another visible subject without creating an occurrence
- owner accept / reject / alternative-name decision
- owner/community conflict becomes disputed and deactivates projection
- consensus excludes AI/system, deduplicates latest claim per actor, and requires 2 supporters plus 2/3 support
- identification queue order remains independent from recruitment operations
- AI vote excluded
- accepted identification change
- occurrence projection activate / deactivate
- environment assessment without monitoring promotion

### Privacy

Verify all public surfaces:

- HTML
- DOM attributes
- JSON / API
- JSON-LD / metadata
- map payload
- cards / feed / search
- downloadable media metadata
- area profile / monitoring
- export

Exact protected location exposure must be zero.

### Visual QA

At minimum:

- iPhone SE class
- common smartphone
- tablet
- small laptop
- desktop
- wide desktop

Cover loading, AI processing, provisional, human_asserted, disputed, multiple observations, community activity, environment assessment, error and empty states.

## 6. Observability

Track at least:

- records saved
- AI jobs queued / succeeded / failed / replayed
- provisional observations created
- human-asserted / excluded observations
- split / merge corrections
- identification source distribution
- active occurrence projections
- projection rejection reasons
- old/new read differences
- privacy suppression reasons
- monitoring promotion sources

Metrics must not expose secret, private exact location, or customer-specific data.

## 7. API migration contract

Additive observation-first endpoints:

- `GET /api/v1/records/:recordId/observations`
- `POST /api/v1/records/:recordId/observations`
- `PATCH /api/v1/records/:recordId/identification-policy`
- `GET /api/v1/record-observations/:observationId`
- `PATCH /api/v1/record-observations/:observationId`
- `POST /api/v1/record-observations/:observationId/identifications`
- `POST /api/v1/record-observations/:observationId/owner-decision`
- `PUT /api/v1/record-observations/:observationId/evidence`
- split / merge endpoints under `/api/v1/record-observations/:observationId`
- `GET /api/v1/identification-queue`

既存のoccurrence-compatible `/api/v1/observations/:id/*`はcutover gate完了まで維持します。record/observation単位のpublic responseへexact location、coordinate-derived ID、cell、mesh、geohashを含めません。aggregate map APIはPR0のk-anonymous map contractに従います。

## 8. Rollback

Before cutover:

- feature flag / route selection returns readers to old path
- dual-write can continue or stop safely by phase
- new tables remain additive
- old data remains authoritative for rollback window

After cutover:

- rollback target is an exact verified commit / artifact
- backfill and projection runs have immutable evidence
- no destructive contract step until rollback window and audit pass

DB direct edits and ad-hoc reverse migration are prohibited.

## 9. Stop conditions

Stop the affected phase when:

- current source / schema cannot be verified
- dirty or conflicting migration lane cannot be isolated
- old/new data differences include unexplained P0 / P1
- AI-created data is promoted beyond provisional or counted as a community vote
- location protection differs by public surface
- rights / consent provenance is missing
- rollback cannot preserve source records
- production, DB, migration, secret, DNS, permission or customer-send approval is required

Other independent doc or test work may continue.

## 10. Completion

The program is complete only when:

- observation-first read and write are canonical
- record supports 0..N observations
- observation-media is many-to-many
- AI provisional creation is idempotent and editable
- human provenance gates human_asserted / accepted / active occurrence
- community identification is always policy-driven, not recruitment-driven
- AI is not counted as a community vote
- environment assessment and monitoring are distinct
- public location protection is common and regression-tested
- old contract is superseded, not silently left as current
- current-state packet and central Issue contain the final merged SHAs and verification evidence
