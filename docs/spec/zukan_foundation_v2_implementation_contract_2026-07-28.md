# ZUKAN Foundation v2 — 凍結最小実装契約

- 日付: 2026-07-28
- `frozen_at`: 2026-07-28
- 状態: frozen source-only contract
- 対象: current app `platform_v2`
- DB・migration・staging・production変更: なし

## 1. 不変条件

1. IDは非意味的・不変とし、名称、自治体コード、国コードを埋め込まない。
2. SourceObject byte列を上書きせず、hashとfixity eventを持つ。
3. Claimはappend-only revision。訂正は新revision。物理eraseのみ例外。
4. Identity mergeはAssertion追加で表し、ClaimやSourceRecordを物理移動しない。
5. splitはmembershipとcanonical assertionの終了・追加で表す。
6. PublicIdentifierを再利用しない。
7. Predicate active versionを変更しない。
8. Claimは書込み時のpredicate URI/versionに固定する。
9. ResolutionRunはclaim store snapshot tokenを持つ。
10. ResolutionPolicyはversion付き宣言データ、evaluatorはversion付きコード。
11. ProjectionSnapshotと発行時manifestは不変。
12. suppress/redact/eraseはappend-only status eventで表す。
13. erase時は元値・対象派生物を削除でき、再現性を`degraded`にする。
14. authorityはversion付きtrust anchorへ到達する。
15. 通常のauthority失効はprospective。
16. 未調査・対象外はCoverage層で扱う。
17. rights unknownを許可として扱わない。
18. 派生ContentObjectは親からrightsを継承しつつoverrideできる。
19. tenant/workspace非公開情報はpublicへfail closed。
20. fixture #16〜#24をDBより先にgreenにする。

## 2. 最小オブジェクト

### Source

- `SourceWork`
- `SourceEdition`
- `SourceObject`
- `SourceFragment`
- `ExtractionRun`
- `ContentObject`: OCR、thumbnail、translation、embedding等

### Identity

- `SubjectIdentity`
- `IdentityResolutionSet`
- `ClusterMembershipAssertion`
- `IdentityRelationAssertion`
- `PublicIdentifier`
- `CanonicalIdentityAssertion`

### Semantics

- `PredicateDefinition`
- `Claim`
- `ClaimRevision`
- `EvidenceLink`

### Authority

- `TrustAnchorPolicy`
- `TrustAnchor`
- `VerificationAssertion`
- `AuthorityAssertion`
- `AuthorityRevocationEvent`

### Resolution

- `ResolutionPolicyVersion`
- `ResolutionRun`
- `ProjectionSnapshot`
- `ProjectionDerivation`

### Governance

- `CorrectionRequest`
- `DisputeCase`
- `SuppressionRequest`
- `ContentGovernanceEvent`
- `SnapshotStatusEvent`
- `ReproducibilityImpact`

### Observation / Coverage

- `SurveyEvent`
- `DetectionOutcome`: detected / not_detected / indeterminate
- `CoverageAssessment`: assessed / unassessed / not_applicable

### Rights / Publication

- `RightsBasis`
- `RightsEvaluation`
- `PublicationEdition`
- `PublicationManifest`
- `PublicationAvailabilityEvent`

## 3. Claim store契約

### ClaimRevision

- `claim_id`
- `revision`
- `subject_id`
- `predicate_uri`
- `predicate_version`
- `value_artifact_id`
- `polarity`
- valid / observed / recorded / publication time
- `recorded_sequence`
- `authority_assertion_ids`
- `visibility`
- `supersedes_revision`

`recorded_sequence`はstore内で単調増加し、同じsequenceを再利用しない。

### ResolutionRun

必須:

- `claim_store_snapshot_token`
- `claim_store_sequence_watermark`
- `recorded_time_watermark`
- `candidate_query_id / version`
- `predicate_registry_snapshot_hash`
- `authority_snapshot_hash`
- `policy_id / version`
- `evaluator_build`
- `target_time`
- `candidate_claim_revisions`
- `accepted_claim_revisions`
- `rejected_claim_revisions / reason_codes`
- `input_hash / output_hash`

candidate queryは`recorded_sequence <= watermark`だけを対象にし、各claimのwatermark時点の最新revisionを選ぶ。

## 4. Predicate互換性validator

同一URIで許可:

- version増加
- label・説明・mapping追加
- enum等の値schema拡大
- cardinality `one → many`

新URI必須:

- value type変更
- schema縮小
- cardinality `many → one`
- polarity変更
- temporal profile変更
- 意味・単位・対象変更

過去Claimは旧versionへ固定し、遡及再検証しない。

## 5. Public ID resolution

`GET /id/{public_id}`相当:

- `200 resolved`: 現行canonical view
- `200 ambiguous`: split・曖昧。候補、effective time、理由、resolution eventを返す
- `308`: 一意の後継だけ
- `404`: 未知のID、または存在自体が機微でpolicy上秘匿する場合

既知の非機微IDをsplit・retireだけで404/410にしない。

## 6. Snapshotと値artifact

Snapshotは値そのものではなく、`ProjectionEntry → ValueArtifact`参照を固定する。Snapshot hashは発行後に変えない。

- suppress: artifact保持、public access停止
- redact: artifact値を削除またはtombstone化。許可時のみcommitment保持
- erase: artifactおよび対象派生物を削除

後続`SnapshotStatusEvent`が、対象claim、field、effective time、理由、再現性を記録する。元manifestを更新しない。

## 7. Authority

Trust anchor初期method:

- official-domain
- government-register
- signed-agreement
- authenticated-account
- manual-institutional-review

AuthorityAssertionは、predicate、subject scope、time、jurisdictionへ限定する。

- prospective revocation: 失効前のtarget timeに対する過去判断は有効
- retroactive revocation: 明示時のみ。影響Snapshotを列挙し、status eventを追加

## 8. Coverage

`not_detected`は実施済みSurveyEventにだけ付ける。調査していなければDetectionOutcomeを作らない。

- `assessed`: applicableかつSurveyEventあり
- `unassessed`: applicableだがSurveyEventなし
- `not_applicable`: predicate applicability外

Coverageは必要時に導出・materializeし、全対象×全predicateの「未調査Claim」を作らない。

## 9. Rights

RightsBasis:

- purpose: metadata / acquisition / preservation / processing / indexing / publication / redistribution / embedding / ai_input / model_training
- basis: allowed / denied / unknown
- evidence
- jurisdiction
- valid period
- `basis_review_due`
- `inherited_from_object_id`

判定:

- public publication・redistribution: unknownはblock/review
- metadata-only: metadata自体が安全ならunknownでも表示可能
- derived ContentObject: 初期継承後に個別override可能

## 10. 実行可能fixture

source-onlyの`node:test`で#16〜#24を実装する。外部I/O、DB、networkを使わない。

- identity split / ambiguous resolution
- non-detection then detection
- publication while dispute pending
- predicate breaking change
- policy version and claim watermark
- rights expiry
- erase and degraded replay
- authority prospective revocation
- equal-authority conflict to DisputeCase

## 11. 完了条件

- TypeScript compileがgreen
- 9 fixture testsがgreen
- runtime route、DB、migrationを変更しない
- production/staging deployを行わない
- prototypeを永続スキーマの確定実装と誤認しない
