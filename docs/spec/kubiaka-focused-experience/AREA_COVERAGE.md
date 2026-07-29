# ZUKAN クビアカツヤカミキリ — Coverage Contract

- Status: deferred public feature / operator-only validation contract
- Date: 2026-07-29
- Parent: `SPEC.md`
- Experience: `kubiaka-watch`
- Public route: not implemented in initial releases
- Future reserved route: `/kubiaka/area`
- Future operator route: `/ops/kubiaka/coverage`

## 1. Decision

一般公開のcoverage mapは初期版で作らない。

初期の利用者価値はprivate receiptと丁寧なfeedbackで証明する。coverageは閉鎖pilotの実データが得られた後、まずoperator限定で実装する。

Public mapの開始には別Decisionと明示承認を必要とする。

## 2. Why public map is deferred

- guest、子ども、学校、自宅、私有地の再識別リスク
- sparse cellと時系列差分による存在推測
- credential rotationを使ったparticipant水増し
- suppression / erase propagation consumerが未実装
- 実データなしでk-threshold、鮮度、分母を決められない
- private receiptより初期利用価値が低い

## 3. Initial operator-only use

Closed pilot後に、非公開operator viewで次を確認できるようにする。

- Record量
- assessed asset量
- evidence role分布
- 異なる日数
- 同じPlaceの再訪
- participant種別
- freshness
- candidate / no-clear-sign / insufficient evidence
- Review coverage
- audit sample
- suppression / erase除外状態

このviewは調査計画と品質管理のために使い、一般公開しない。

## 4. Reuse boundary

既存public mapから再利用するもの:

- cell導出方法
- gridM ladder
- snapshot生成cadenceの仕組み
- privacy-safe location aggregationの一部

再利用しないもの:

- existing public feature schema
- `count`
- `firstObservedAt`
- `latestObservedAt`
- `centroidLat`
- `centroidLng`
- raw taxon mix
- record-level identifier

Kubiaka coverageは別read modelを作るが、第二のcanonical gridや独立した地図基盤は作らない。

## 5. Data source boundary

### 5.1 Casual photo records

Casual photoは次へ利用できる。

- photo Record量
- assessed asset量
- evidence role
- Placeの季節・年次比較
- operator triage

Casual photoから`survey_non_detection`や`current_target_met`を生成しない。

### 5.2 Formal survey

Foundation v2 SurveyEvent / DetectionOutcome / CoverageAssessmentを使用できるのは、次が揃った場合だけ。

- 実在partner
- versioned protocol
- method
- effort
- subject scope
- started / ended time
- accountable review authority

P0とRelease CではKubiaka側からformal surveyを書き込まない。

## 6. Future public projection

Public mapを将来承認する場合の最小payload:

```text
state = no_public_data
      | more_observation_useful
      | observation_progressing
      | current_target_met
      | revisit_due

freshnessBand = unknown
              | within_2_weeks
              | within_2_months
              | older
```

Forbidden public fields:

- raw Record count
- raw photo count
- raw participant count
- exact or raw dates
- exact coordinates
- centroid
- receipt / Record / Place IDs
- suppression reason
- guest-only activity

When `state=no_public_data`, `freshnessBand` must be `unknown`.

Empty and privacy-suppressed cells must produce indistinguishable public payloads.

## 7. Future public threshold

P0ではthresholdを確定しない。

将来public projectionを作る場合:

- guest-only cells never publish
- `distinctAccountParticipants >= k_p`
- `recordCount >= k_r`
- degenerate or missing target config fails closed
- denominator staleness fails closed
- sparse or sensitive contexts may require coarser aggregation
- time-series differencing review is required

Credential rotationによるguest participant数を公開閾値へ使用しない。

## 8. Future spatial granularity

最初のpublic granularity候補:

- municipality
- approved public park
- managed facility group
- ledger-backed target-tree group

500m cellは初期public releaseに使用しない。

500m / 25–50m coverageは、汎用調査基盤、operator planning、closed pilotで使用できる。

## 9. Claim boundary

将来public mapで表示できる最も強い表現:

> この範囲は、定められた確認プロトコルの基準を満たしています。

必ず併記:

> 生息不在や安全を意味しません。

禁止:

- この地域にはいない
- 十分調査したので安全
- 発生していない
- 全ての木を確認済み
- 行政確認済み

## 10. Suppression / erase propagation

既存production consumerがあると仮定しない。

Release Dで新規consumerを実装する。

Required behavior:

1. suppression / erase eventを読む
2. affected Record / occurrenceを集計前に除外する
3. immutable projection editionを再生成する
4. previous editionを上書きしない
5. public serving pointerを新editionへ切り替える
6. withdrawal / correction evidenceを記録する

Suppressionが次editionへ伝播しない場合、coverage releaseを停止する。

## 11. Projection versioning

Coverage projection is immutable and versioned.

Store:

- projection edition ID
- source watermark
- policy version
- protocol version
- aggregation grid / Place group version
- generatedAt
- privacy decision digest
- included / excluded summary for operator only

Public refresh cadence must not allow easy differencing attacks. Cadence and privacy budget are decided from pilot data, not guessed in P0.

## 12. Accessibility

Future map requires equivalent list view.

- color is not the only signal
- pattern, icon, label, text are combined
- keyboard traversal
- screen-reader region summaries
- text 200%
- map unavailable fallback

## 13. Release gates

### Release D0 — operator fixture

- no public route
- synthetic / staging fixture
- no guest data
- accessibility list parity

### Release D1 — operator real data

- closed pilot only
- account and guest data visible only to authorized operator
- suppression consumer green
- no external send

### Future Public Map

Separate Decision required.

Must include:

- real privacy threat model
- threshold evidence
- differencing tests
- guest-only exclusion
- sensitivity aggregation
- suppression propagation
- operational owner
- rollback / kill switch

## 14. Stop conditions

- public map requested before closed-pilot evidence
- guest-only cells would publish
- raw count/date/centroid appears in public payload
- empty and suppressed cells differ
- `no_public_data` leaks freshness
- suppression cannot propagate
- target config is zero, missing, stale, or invalid
- public grid is finer than approved sensitivity floor
