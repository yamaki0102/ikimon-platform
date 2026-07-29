# ZUKAN クビアカツヤカミキリ見守り — Implementation Master Plan v2

- Status: second-review candidate / implementation blocked
- Date: 2026-07-29
- Product contract: `SPEC.md`
- Area contract: `AREA_COVERAGE.md`
- Strategy: `yamaki0102/ikimon-business-strategy#42` → `#43`
- Superseded implementation: `yamaki0102/ikimon-platform#1492`

## 0. Decision

実装は可能だが、特設LPや小規模UI改修ではない。

成立に必要なもの:

- existing auto-routing interlock
- shared composer context
- durable Record link / outbox
- private guest receipt
- receipt-scoped claim
- orthogonal state projection
- submitted / assessed asset accounting
- Foundation-backed Survey / Detection
- versioned FeedbackEdition
- privacy-safe aggregate map
- operator Review workflow

旧#1492は中核モデルが本計画と矛盾し、public privacyを退行させるためsupersededとする。branchは参照用に残し、後継実装は最新mainから新規作成する。

## 1. Non-negotiable invariants

1. Account、Record、Media、Placeを二重作成しない
2. composerをforkしない
3. Record保存とAI完了を分離する
4. Record保存とexperience link失敗を`link_pending`で表現する
5. AI、人、専門家、recipient responseを同じauthorityにしない
6. submitted photo数とassessed asset数を分ける
7. free-form photoからsurvey non-detectionを生成しない
8. Foundation v2 Survey / Detection / Coverageを非検出正本にする
9. public mapはlive Record queryにしない
10. empty cellとsuppressed cellを公開上区別しない
11. distinct participantとRecordの丕方をpublic thresholdにする
12. raw date / exact location / Record IDをpublic mapへ出さない
13. invalid targetをfail closedにする
14. Review確定とexternal sendを同一操作にしない
15. existing auto-routingをexplicit gateなしで発火させない
16. suppression / correction / eraseをreceipt、feedback、mapへ反映する

## 2. Corrected PR topology

現在:

```text
strategy #42
  └─ strategy #43

platform #1489
  └─ platform #1491

platform #1492 = closed / superseded
```

正常化:

1. #42をsecond review対象に含め、routing boundaryを確定
2. auto-routing interlockを独立した小PRで実装
3. #1489をstrategy exact SHAへ追従・green後にmainへ統合
4. #43を最新strategy mainへrebaseし確定
5. #1491をplatform mainへ付け替え、docs-onlyとして統合
6. pure contract後継PRを最新mainから作成

親子stackは常に一段までとする。#1491と後継実装を長期stackにしない。

## 3. Release sequence

### Gate 0 — Auto-routing safety

Scope:

- `alertDispatcher` / invasive reporting経路のread-only調査
- active experience linkを持つOccurrenceのinterlock
- explicit routing gate absence → deny
- law status / AI confidence aloneではdeliveryを作らない
- existing non-experience behaviorを回帰させない

Exit:

- failing→passing test
- no external send executed
- runtime behavior changeはinterlockだけ
- Record保存・private reviewは継続

### Release B — Private contribution foundation

先にA/static previewを独立Releaseとして作らない。public landing / guide / shellはBの一部として、実際のprivate contribution導線と同時に検証する。

Scope:

- `/kubiaka`, `/guide`, `/about`, `/faq`
- dedicated shell
- existing composer reuse at `/kubiaka/record`
- durable experience Record link
- link outbox / transaction
- guest credential
- private receipt
- receipt-scoped claim
- `/kubiaka/me`, `/me/records`, `/records/:id`

No:

- public live area map
- automated Feedback publication
- external send

Exit:

- 1–6 photo save / retry
- guest A/B and account A/B isolation
- shared-device viewing isolation
- stale cookie / replay / logout
- link partial failure recovery
- claim rollback / idempotency
- Node / Worker parity where applicable
- staging authenticated and guest browser QA

### Closed pilot B1

- one region
- invite-controlled entry
- external send disabled
- area map fixture only
- operator can view private Evidence
- no specialist SLA

Measure:

- save success
- receipt return
- claim success
- shared-device confusion
- link recovery
- privacy incidents

### Release C — Delayed feedback beta

Scope:

- assessed asset IDs
- image role coverage
- submitted / assessed count
- asynchronous Assessment
- immutable FeedbackEdition
- automated feedback
- trained reviewer override
- random no-clear-sign audit
- more-evidence request
- `/ops/kubiaka/inbox`

No:

- public area live data
- specialist SLA
- external routing

Exit:

- honest assessed count copy
- failure / stale / published combinations represented
- capacity backpressure tested
- Assessment stop does not break receipt
- false-negative audit process operational

### Release D — Monitoring coverage beta

Scope:

- existing public map snapshot pipeline
- aggregate edition from Foundation Survey / Detection / Coverage
- contributor and Record privacy threshold
- freshness band
- target validation
- denominator SourceEdition / staleness
- `/kubiaka/area`
- accessible list parity
- `/ops/kubiaka/coverage`

No:

- exact findings map
- absence conclusion
- denominator-free percentage

Exit:

- sparse / one-participant / school / home / stale / no-denominator fixtures
- empty vs suppressed indistinguishable
- raw date absent
- degenerate target fail closed
- suppression propagation

### Release E — Approved routing

Scope:

- existing invasive reporting recipient / jurisdiction model
- focused experience interlock gate enablement
- human Review requirement
- operator separate approval
- idempotent send
- sent / acknowledged / failed / expired
- Case follow-up

No:

- unregistered recipients
- emergency guarantee
- automatic delivery from law status

Exit:

- real recipient identity
- current consent
- data allowlist
- operational owner
- acknowledgement method
- rollback / incident runbook
- explicit production and external-send approval

## 4. State model implementation

### Persistence

```ts
type PersistenceState =
  | "draft"
  | "saving"
  | "link_pending"
  | "saved"
  | "save_failed"
  | "suppressed"
  | "erased_reference_only";
```

### Assessment

```ts
type AssessmentState =
  | "not_started"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "stale"
  | "cancelled";
```

### Feedback

```ts
type FeedbackState = "none" | "draft" | "published" | "superseded" | "withheld";
```

### Action

```ts
type ActionState =
  | "not_applicable"
  | "candidate"
  | "operator_approved"
  | "sent"
  | "acknowledged"
  | "failed"
  | "expired"
  | "follow_up_due"
  | "closed";
```

### Authority

```ts
type ReviewAuthority =
  | "automated"
  | "trained_reviewer"
  | "accountable_specialist"
  | "approved_recipient";
```

Authority is not inferred from Action or Case state.

Contributor projection input:

```ts
interface KubiakaContributorProjectionInput {
  persistence: PersistenceState;
  assessment: AssessmentState;
  feedback: FeedbackState;
  action: ActionState;
  authority: ReviewAuthority | null;
  hasUnreadFeedback: boolean;
  hasMoreEvidenceRequest: boolean;
  isRevisitDue: boolean;
}
```

Blocking combinations:

- saved + failed + none
- saved + stale + published
- saved + running + published
- saved + published + sent
- saved + published + follow_up_due
- link_pending + not_started + none

## 5. Data reuse map

| Need | Source of truth | New object |
|---|---|---|
| Original contribution | existing Record / Observation / Media | none |
| Experience context | durable Record link | link + outbox only |
| Guest access | existing credential pattern | Kubiaka participant / receipt |
| Claim | existing transactional pattern | receipt-scoped claim log |
| Taxon | existing opaque Taxon identity | no scientific-name ID |
| Survey effort | Foundation v2 SurveyEvent | none |
| Detection / non-detection | Foundation v2 DetectionOutcome | none |
| Coverage assessment | Foundation v2 / projection | Kubiaka read projection only |
| Feedback | contributor-facing edition | Kubiaka FeedbackEdition |
| Public map | existing ProjectionSnapshot / map snapshot | Kubiaka projection rules |
| Routing | existing invasive reporting | interlock + approval extension |

## 6. Minimal additive persistence

Do not create generic `focused_experiences` DB rows in P0.

Candidate objects:

1. `focused_experience_record_links` or equivalent common link
2. `focused_experience_link_outbox`
3. `kubiaka_participants`
4. `kubiaka_receipts`
5. `kubiaka_receipt_claims`
6. `kubiaka_feedback_editions`

Use existing:

- SurveyEvent / DetectionOutcome / CoverageAssessment
- ProjectionSnapshot
- invasive recipient / delivery
- suppression / correction machinery

Migration principles:

- additive only
- opaque IDs
- tenant scope
- hashed guest secret
- idempotency
- append-only FeedbackEdition
- no duplicate Record / asset
- rollback rehearsal
- PostgreSQL / D1 only where active runtime requires parity
- no production apply without explicit approval

## 7. Link outbox contract

Atomic ideal:

```text
BEGIN
save Record
save experience link or outbox
COMMIT
```

If existing Record service cannot include the link in the same transaction:

- write durable outbox before returning success
- idempotency key = experience + canonical Record ID + participant
- worker reconciles link and receipt
- repeated execution is safe
- `link_pending` is visible privately
- no public map / Assessment starts before link is ready
- operator can inspect stalled entries

## 8. Guest and shared-device contract

- one device is not one person
- private receipt requires scoped credential
- default guest history = latest receipt only
- explicit `show other records on this device`
- persistent `use as another person` action
- receipt-scoped claim default
- explicit all-receipt claim
- logout clears account display without exposing guest history
- stale guest credential cannot claim

Required tests:

- guest A → guest B
- guest → account A
- account A → logout → account B
- stale cookie
- token mismatch
- replay
- claim partial failure
- shared school tablet
- Blob / large photo recovery

## 9. Photo and feedback contract

Input:

```ts
interface KubiakaAssessmentEdition {
  submittedAssetIds: string[];
  assessedAssetIds: string[];
  coverageItems: CoverageItem[];
  findings: Finding[];
  modelOrRuleVersion: string;
  limitations: string[];
}
```

Derived:

```text
submittedPhotoCount = distinct submitted photo assets
assessedPhotoCount = distinct assessed photo assets
```

Never accept assessed count as an independent caller number.

Copy tests:

- submitted 6 / assessed 3 → `6枚のうち3枚を確認しました`
- submitted 6 / assessed 6 → `6枚を確認しました`
- assessed asset absent from coverage → fail validation

## 10. Survey and non-detection mapping

Only Foundation-backed input can set `isSurveyUsable`.

```ts
interface SurveyBackedEvidence {
  surveyEventId: string;
  protocolId: string;
  protocolVersion: string;
  effort: unknown;
  method: unknown;
  startedAt: string;
  endedAt: string;
  outcome: "detected" | "not_detected" | "indeterminate";
}
```

Kubiaka photo coverage must not synthesize this object.

Core roles for target protocol must be `visible`; `partial` is a limitation.

## 11. Public map privacy contract

Public projection:

```ts
interface PublicCoverage {
  state: "no_public_data" | "more_observation_useful" | "observation_progressing" | "current_target_met" | "revisit_due";
  freshnessBand: "within_2_weeks" | "within_2_months" | "older" | "unknown";
  nextAction: string | null;
  protocolVersion: string;
  projectionEdition: string;
}
```

Privacy gate:

```text
suppress if participantCount < k_p OR recordCount < k_r
```

`suppress` returns the same public shape/state as empty data.

No raw timestamps, counts, IDs, suppression reason.

Target validation rejects zero, negative, NaN, missing version, stale denominator.

## 12. Existing auto-routing interlock PR

Independent scope only:

- identify occurrence experience link
- default deny invasive delivery for active focused experience
- allow existing standard behavior for unscoped occurrence
- explicit test for Aromia-like law status
- explicit test that operator review alone does not send
- explicit test that missing recipient consent does not send

Do not mix this safety fix with Kubiaka UI or migrations.

## 13. Review and operations model

Automated feedback completes normal records.

Review queue receives:

- adult / frass / exit-hole candidate
- low confidence
- contradictory evidence
- insufficient evidence requiring request
- random no-clear-sign audit
- routing candidate
- appeal / correction

Backpressure:

- queue over capacity does not reject save
- Assessment can pause
- receipt remains available
- copy does not promise a deadline
- external routing remains off

## 14. Pilot metrics

Before paid municipal quality claims:

1. human Review minutes per Record
2. no-clear-sign false negative rate, random sample >= 200 when available
3. frass candidate false positive rate
4. Feedback latency p50 / p90 / p99
5. claim success rate
6. shared-device confusion / privacy incident rate
7. `current_target_met` field verification agreement
8. denominator ledger freshness / duplicate / missing rate

## 15. Test matrix

### Unit

- 4-axis projection
- link_pending
- submitted vs assessed
- partial exclusion
- target validation
- denominator staleness
- registry active/read_only/retired

### Integration

- Record → outbox → link → receipt
- partial failure recovery
- claim transaction
- Foundation Survey mapping
- Feedback append-only
- ProjectionSnapshot generation
- suppression propagation

### Security / privacy

- guest/account isolation
- shared-device viewing
- receipt enumeration
- CSRF / same-origin
- auto-routing interlock
- one-participant map suppression
- empty/suppressed indistinguishability
- adjacent-cell differencing

### Browser

- 320 / 375 / 390 / 412 / 768 / 1024 / 1280 / 1440 / 1536
- 200% text
- keyboard / screen reader
- map/list parity
- six-photo retry
- login return

### Operations

- queue overload
- Assessment disabled
- recipient consent expiry
- idempotent routing
- rollback rehearsal

## 16. Critical path

1. second architecture review of #42/#43/#1491
2. resolve all P0 / accepted P1 in source of truth
3. auto-routing interlock PR
4. #1489 green and merge
5. #43 / #1491 rebase and merge
6. new pure contract PR from main
7. Migration 1 + Release B staging
8. closed pilot B1
9. Release C
10. Release D
11. Release E under explicit approval

## 17. Stop conditions

Stop if any remains:

- existing auto-routing can bypass explicit gate
- state axes inconsistent
- link recovery undefined
- guest shared-device viewing leaks
- assessed count unverifiable
- survey non-detection can be caller-forced
- public suppression is distinguishable
- single participant can publish a cell
- target can fail open
- authority inferred from workflow
- suppression cannot propagate
- production / external-send approval absent
