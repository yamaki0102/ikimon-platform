# Kubiaka Architecture Reviews — Final Resolution Record

- Date: 2026-07-29
- Status: closed / decisions incorporated
- Source: two external read-only architecture reviews supplied by the project owner
- Active contracts:
  - `docs/spec/kubiaka-focused-experience/SPEC.md`
  - `docs/spec/kubiaka-focused-experience/IMPLEMENTATION_MASTER_PLAN.md`
  - `docs/spec/kubiaka-focused-experience/PLAN.md`
  - `docs/spec/kubiaka-focused-experience/AREA_COVERAGE.md`

## 1. Final product decision

Adopt:

> Receipt-first, Map-later。返事を完成させてから地図を描く。

Initial product:

- guest/member 1–6 photo save
- private receipt
- receipt-scoped claim
- dedicated member workspace
- submitted/assessed asset accounting
- delayed photo-scope feedback
- operator review queue

Deferred:

- public coverage map
- survey non-detection
- public 500m cells
- external routing
- specialist SLA

## 2. Safety decisions

- all managed-taxon notifications are denied at dispatcher entry
- taxon-side normalized name/synonym scope is used before Record link exists
- `link_pending` never permits Assessment, feedback publishing, or alerts
- law status, AI confidence, candidate, or Case alone never permits send
- external routing remains a later Release with explicit approval

## 3. Ownership and shared-device decisions

- guest view is empty before current-session submission
- after submission, only the current-session receipt is shown
- device history is not a default guest feature
- `別の人が使う` rotates the guest credential
- account claim is receipt-scoped
- no implicit claim-all in P0

## 4. State decisions

Use orthogonal state axes:

- Persistence including `link_pending`
- Assessment
- Feedback
- Action

Review authority remains a FeedbackEdition attribute and cannot be inferred from workflow or Case position.

## 5. Feedback decisions

- `submittedAssetIds`, `assessedAssetIds`, `unassessedAssetIds` are separate
- counts are derived from asset IDs
- current `recordPhotoFeedback` requires an asset-aware adapter or modification
- no silent MAX_IMAGES truncation may be presented as complete assessment
- whole-Record no-clear-sign wording requires all intended submitted assets to be assessed

## 6. Scientific claim decisions

- P0 supports photo-scope wording only
- casual photos do not create `survey_non_detection`
- Foundation v2 SurveyEvent / DetectionOutcome remains the future source of truth
- formal survey integration starts only with a real partner and versioned protocol

## 7. Coverage decisions

- public map is removed from initial releases
- operator-only coverage may start after feedback pilot evidence
- existing map reuses cell derivation and cadence mechanism only
- existing public feature fields are not reused
- suppression/erase propagation requires a new Release D consumer
- future public map requires a separate Decision

## 8. Abstraction decisions

- no generic `focused_experiences` DB platform in P0
- Kubiaka persistence remains Kubiaka-specific
- shared skeleton is limited to source registry, Record reuse, and safe routing concepts
- generalization is reconsidered when a second real experience exists

## 9. PR decisions

- strategy #42: finalize and merge first
- strategy #43: Receipt-first decision, rebase and merge after #42
- platform #1489: update strategy SHA, verify, merge
- platform #1491: final docs/spec, rebase and merge
- platform #1492: closed and superseded, not an implementation base
- successor runtime PRs: create from latest main only

## 10. Review-cycle closure

No further external architecture review is required before Gate 0 implementation.

Future decisions are based on:

- code review
- contract and security tests
- staging runtime evidence
- closed-pilot metrics
- explicit approval boundaries

Review request packets are not active product specifications and have been removed.

## 11. Mutation boundary at closure

Completed:

- strategy/spec/plan updates
- closing superseded #1492
- cross-project planning records

Not performed:

- runtime route implementation
- DB or migration apply
- staging or production deploy
- taxon routing activation
- secret / DNS / permission change
- external send
