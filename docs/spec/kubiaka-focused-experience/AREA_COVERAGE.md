# ZUKAN クビアカツヤカミキリ — Area Coverage Map Contract v2

- Status: second-review candidate
- Date: 2026-07-29
- Parent: `SPEC.md`
- Public route: `/kubiaka/area`
- Operator route: `/ops/kubiaka/coverage`

## 1. Purpose

地図の主役を発見地点にせず、地域のどこで、いつ、どの程度、どの品質で確認が行われたかを示す。

利用者が全体を見て次を判断できるようにする。

- 公開できる調査情報がない地域
- 追加の記録が役立つ地域
- 調査が進んでいる地域
- 今季の確認基準を満たした地域
- 過去の調査が古くなり再訪が役立つ地域

この地図は生息、不在、安全、行政対応完了を断定しない。

## 2. Strongest allowed claim

> この範囲は、ZUKANで定めた今季の確認基準を満たしています。生息不在や安全を意味するものではありません。

禁止:

- この地域にはいない
- 十分調査したので安全
- 発生していない
- 全ての木を確認済み
- 行政が確認済み

## 3. Reuse existing public-map privacy

既存public map aggregate snapshotを正規基盤とする。

- Record live queryを公開しない
- existing gridM ladder / aggregate snapshotを使用
- 新しいcanonical grid体系をP0で導入しない
- Publicationは既存`ProjectionSnapshot`または同等のimmutable editionとして扱う
- suppression / correction / eraseが次editionへ伝播する

日本標準地域メッシュ等が必要な場合はcrosswalkまたはexport変換として扱い、第二のcanonical gridにしない。

## 4. Public states

公開状態は次だけとする。

```text
no_public_data
more_observation_useful
observation_progressing
current_target_met
revisit_due
```

### `no_public_data`

表示:

> この範囲に公開できる調査情報はまだありません

次を公開上区別しない。

- 本当にRecordがない
- Recordはあるが少数
- participant数不足
- 学校・自宅・私有地等で抑制
- 隣接セル差分から再識別可能
- operatorが公開を保留

`privacy_suppressed`、suppression reason、hidden countをpublic payloadへ出さない。

### `more_observation_useful`

> もう少し記録があると状況が分かります

### `observation_progressing`

> 調査が進んでいます

### `current_target_met`

> 今季の確認基準を満たしています

凡例とセル詳細に必ず次を併記する。

> 生息不在や安全を意味するものではありません。

### `revisit_due`

> もう一度確認したい時期です

## 5. Public payload

最小形:

```ts
interface PublicAreaCoverageProjection {
  areaId: string;
  state:
    | "no_public_data"
    | "more_observation_useful"
    | "observation_progressing"
    | "current_target_met"
    | "revisit_due";
  freshnessBand: "within_2_weeks" | "within_2_months" | "older" | "unknown";
  nextAction: "record_here" | "add_another_day" | "revisit" | "record_elsewhere" | null;
  denominatorLabel?: string;
  denominatorCoverageRatio?: number;
  protocolVersion: string;
  projectionEdition: string;
}
```

Public payloadへ出さない:

- Record IDs
- participant IDs
- raw Record / photo counts
- distinct participant count
- exact coordinates
- full address
- raw `lastObservedAt`
- exact survey date
- suppression reason
- candidate raw count
- school / home / private-land flag

operator viewだけがraw値を持つ。

## 6. Privacy threshold

公開には少なくとも次の両方を必要とする。

```text
distinctParticipantCount >= publicMinParticipants
recordCount >= publicMinRecords
```

条件はORで抑制する。どちらか一方でも不足すれば`no_public_data`。

一人の熱心な参加者が多数投稿しても閾値を突破できない。

追加のprivacy floor:

- school / children
- home nearby
- private land
- sensitive place
- adjacent-cell differencing risk
- temporal differencing risk

必要に応じて隣接セルへ統合する。セル統合前後でRecordの存在を推測できる場合は公開しない。

## 7. Coverage dimensions

単一スコアを正本にしない。次を分けて持つ。

### Volume

- Record count
- submitted photo count
- assessed photo count
- screenable count
- Foundation survey count

### Breadth

- unique aggregate areas
- unique observed target units
- public Place groups
- known target ledger coverage

### Repeat

- distinct survey days
- repeated target units
- repeated Place candidates
- seasonal coverage

同日・同participant・同対象の連続投稿を独立調査として水増ししない。

### Quality

- whole tree visible
- trunk visible
- base visible
- adult / frass / exit hole visibility
- image limitations
- assessed asset coverage

### Freshness

- latest valid SurveyEvent
- protocol-defined aging
- protocol-defined revisit due

新しいcasual photoだけで古い正式Surveyの鮮度を更新しない。

### Denominator

Known denominatorの例:

- registered target trees
- approved parks
- management blocks

Required metadata:

- SourceEdition
- total target units
- observed target units
- source updated at
- imported at
- validity / review date
- rights and geographic scope

台帳がstaleの場合、割合をpublicへ出さない。

分母が無い場合は調査努力を示し、地域網羅率を表示しない。

## 8. Survey source of truth

`surveyUsable`と`not_detected`はFoundation v2を正本とする。

Required:

- SurveyEvent
- protocol / method / effort
- started / ended
- subject scope
- DetectionOutcome
- CoverageAssessment

自由投稿のKubiaka evidence coverageだけでsurvey non-detectionを生成しない。

## 9. Target contract

```ts
interface KubiakaAreaTarget {
  protocolVersion: string;
  minimumSurveyUsableRecords: number;
  minimumUniqueSurveyDays: number;
  minimumRepeatObservedUnits: number;
  revisitAfterDays: number;
  minimumKnownTargetCoverageRatio?: number;
  denominatorMaxAgeDays?: number;
}
```

Validation:

- required count fields are finite integers >= 1
- `revisitAfterDays >= 1`
- ratio is 0 < r <= 1
- protocolVersion is non-empty
- denominator ratio cannot be used without a valid non-stale denominator

Invalid / missing / NaN / zero targetは公開判定をfail closedし、`no_public_data`へ落とす。`required <= 0 => met`は禁止。

## 10. Classification order

1. target invalid → `no_public_data`
2. privacy threshold / contributor sensitivity fail → `no_public_data`
3. no valid aggregate data → `no_public_data`
4. valid prior coverage but revisit overdue → `revisit_due`
5. all positive target criteria met → `current_target_met`
6. defined progress criteria met → `observation_progressing`
7. otherwise → `more_observation_useful`

`current_target_met`には最低限次を必要とする。

- Foundation-backed SurveyEvent
- survey usable count
- distinct survey days
- repeated observed units
- freshness within target
- valid denominator ratio when configured

通常写真やRecord数が多いだけでは成立しない。

## 11. Progress definition

`observation_progressing`の定義を曖昧な平均値にしない。

P0では次とする。

- 3つの必須criteriaのうち2つ以上が正の進捗を持つ
- 少なくとも1件のFoundation-backed SurveyEventがある
- targetはvalid
- privacy thresholdを満たす

criteriaごとの不足量をoperator projectionで保持する。

## 12. Cell interaction

Public cell detail:

```text
この範囲の見守り状況

調査が進んでいます
別の日の記録があると、季節や時間による違いを比べやすくなります。

最終確認: 2週間以内

[このあたりを記録する]
```

Raw件数・生日時は出さない。

Known denominatorが公開可能な場合:

```text
登録済み対象木のうち65%を今季確認
台帳: ○○市街路樹台帳 2026年版
```

Denominatorなし:

```text
地域全体の対象木数は未確定です。割合ではなく、集まった調査努力を表示しています。
```

## 13. Map layers

Default:

1. 調査の進み具合

Optional:

2. freshness band
3. repeat status
4. assessed evidence coverage
5. Feedback / Review progress
6. approved aggregate findings

未確認候補や少数候補を赤い個別ピンで表示しない。

## 14. Contributor feedback

投稿後に事実として返す。

Allowed:

> あなたの記録は、この範囲の確認日に追加されました。

ただしpublic threshold未達やprivate contextの場合、公開地図へ出たと断定しない。

> 記録は保存されました。公開地図への反映は、位置を守るため集計条件が整った場合だけ行います。

ランキング、競争、危険な場所への誘導を行わない。

## 15. Operator view

Operator only:

- raw / deduplicated counts
- distinct participants
- survey / casual separation
- assessed / submitted photo counts
- evidence role deficits
- repeat / temporal concentration
- privacy suppression reasons
- adjacent-cell risk
- denominator SourceEdition / freshness
- protocol version
- no-clear-sign audit rate
- candidate concentration
- projection edition diff

## 16. Projection and suppression

Area outputはimmutable ProjectionSnapshotまたは同等の既存map snapshot editionとして保存する。

新edition生成時に次を適用する。

- suppression
- correction
- erase-reference policy
- rights change
- participant / Record removal
- protocol version change
- denominator edition change

過去editionを上書きしない。public readerはactive editionだけを読む。

## 17. Blocking tests

- empty cell and suppressed cell produce identical public state/payload shape
- one participant with many Records remains `no_public_data`
- participant threshold and Record threshold both required
- raw dates never appear in public JSON/HTML
- degenerate target fails closed
- denominator stale → no ratio
- casual photo cannot refresh formal Survey freshness
- partial evidence cannot create survey non-detection
- adjacent-cell differencing fixture
- school/home/private-land fixture
- suppression propagates to next edition
- map and accessible list have equivalent claims
- legend always includes non-absence disclaimer

## 18. Accessibility

- color alone is insufficient
- pattern, icon, label, text are combined
- keyboard and screen reader navigation
- 200% text
- map-unavailable list parity
- no horizontal overflow at 320px
- selected cell returns focus correctly

## 19. Stop conditions

- public `privacy_suppressed` state exists
- raw date or raw count is public
- participant threshold absent
- target can be zero or NaN
- Foundation Survey linkage absent
- denominator staleness not checked
- suppression cannot propagate
- second architecture review incomplete
