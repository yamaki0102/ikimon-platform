# PLAN — Record / Observation migration

## 1. Plan status

本書は実装順、migration、verification、rollbackの正本です。

active PR、現在フェーズ、blocker、deploy状態は`yamaki0102/all-projects-management`を正本とし、本書へ時系列で複製しません。

今回のdoc-only PRではcode、DB migration、deployを実行しません。

## 2. Preconditions

実装開始前に次を監査します。

- 現行record / visit / occurrence / AI candidate / media schema
- current write paths
- current record detail read paths
- multi-subject、coexisting taxa、visual rescueの既存実装
- community identificationとreviewer state
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

### PR-B — Expand schema

Additive only:

- observations
- observation-media link
- identification provenance / state
- occurrence projection provenance / version
- environment assessment boundary
- audit / idempotency fields

Rules:

- existing columns / tablesを削除・renameしない
- current readers / writersを壊さない
- migrationはfresh DB、backup restore、stagingで検証してからremote apply候補にする
- production migrationは別承認

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
- AIだけでconfirmed / accepted / active occurrenceへ遷移しない

Exit:

- exact input replayがidempotent
- AI-created records are always provisional
- old write path remains compatible

### PR-D — Backfill

Scope:

- existing record / occurrence / subject-like dataをobservation modelへ変換
- provenance、source IDs、rule version
- ambiguous records quarantine / needs-review
- pet / captive / group / unknown mapping

Rules:

- 曖昧なsubject境界を推測でconfirmed化しない
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

- record containerとobservation cards
- multi-observation edit / split / merge / exclude
- media reassignment
- AI provisional state
- community identification without recruitment action
- pet / unknown / group presentation

Rules:

- 「みんなに聞く」は追加しない
- AIをcommunity票に含めない
- human / AI / reviewer provenanceを混同しない
- no-JS / accessibility / mobile statesを確認

Exit:

- 0 / 1 / N observationsのUIが成立
- user can correct AI split / merge
- public community identification works by policy
- accessibility and visual QA pass

### PR-G — Occurrence projection and research gate

Scope:

- confirmed observation + accepted identificationからoccurrence projection
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

Cover loading, AI processing, provisional, confirmed, multiple observations, community activity, environment assessment, error and empty states.

## 6. Observability

Track at least:

- records saved
- AI jobs queued / succeeded / failed / replayed
- provisional observations created
- human-confirmed / excluded observations
- split / merge corrections
- identification source distribution
- active occurrence projections
- projection rejection reasons
- old/new read differences
- privacy suppression reasons
- monitoring promotion sources

Metrics must not expose secret, private exact location, or customer-specific data.

## 7. Rollback

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

## 8. Stop conditions

Stop the affected phase when:

- current source / schema cannot be verified
- dirty or conflicting migration lane cannot be isolated
- old/new data differences include unexplained P0 / P1
- AI-created data is promoted beyond provisional
- location protection differs by public surface
- rights / consent provenance is missing
- rollback cannot preserve source records
- production, DB, migration, secret, DNS, permission or customer-send approval is required

Other independent doc or test work may continue.

## 9. Completion

The program is complete only when:

- observation-first read and write are canonical
- record supports 0..N observations
- observation-media is many-to-many
- AI provisional creation is idempotent and editable
- human provenance gates confirmed / accepted / active occurrence
- community identification is always policy-driven, not recruitment-driven
- AI is not counted as a community vote
- environment assessment and monitoring are distinct
- public location protection is common and regression-tested
- old contract is superseded, not silently left as current
- current-state packet and central Issue contain the final merged SHAs and verification evidence
