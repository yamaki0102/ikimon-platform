# ZUKAN クビアカツヤカミキリ — Area Coverage Map Contract

- Status: active sub-contract
- Date: 2026-07-29
- Parent: `SPEC.md`
- Experience: `kubiaka-watch`
- Public route: `/kubiaka/area`
- Operator route: `/ops/kubiaka/coverage`

## 1. Purpose

地図の主役を発見地点にせず、地域のどこで、いつ、どの程度、どの品質で確認が行われたかを示す。

利用者が地図全体を見て、次を判断できる状態を作る。

- まだ記録がほぼない地域
- 追加の写真が役立つ地域
- 調査が進んでいる地域
- 今季の確認基準を満たした地域
- 過去には確認されたが、再訪時期を迎えた地域

この地図は、生息、不在、安全、行政対応完了を断定する地図ではない。

## 2. Claim boundary

表示できる最も強い表現は次である。

> この範囲は、ZUKANで定めた今季の確認基準を満たしています。

次の表現は禁止する。

- この地域にはいない
- 十分調査したので安全
- 発生していない
- 全ての木を確認済み
- 行政が確認済み

`確認基準を満たした`は、設定された調査努力量、写真品質、反復、鮮度、明示された分母に対する状態であり、生物学的な不在証明ではない。

## 3. Spatial unit

公開地図は個別Record地点を表示しない。

集計単位は次のいずれかとする。

1. privacy-safe aggregate cell
2. 公開が承認された公園、街区、施設群等のPlace group
3. 管理主体が提供した対象木台帳の公開可能な集約単位

公開解像度は地域、投稿密度、子ども・学校・自宅・私有地等の感度に応じて変更する。固定の細粒度を全国一律に適用しない。

投稿数が公開閾値に満たないセルは、隣接セルへ統合するか、状態を非表示にする。少数投稿から個人の行動や撮影地点を推測できる表示は禁止する。

## 4. Coverage dimensions

一つの投稿件数だけで十分性を判定しない。最低限、次を分離する。

### 4.1 Volume

- Record数
- 写真数
- `screenable_record`数
- `survey_usable`数

大量の細部写真だけで、地域全体の確認が進んだとは扱わない。

### 4.2 Spatial breadth

- 記録された集約セル数
- 記録された公開可能なPlace group数
- 異なる対象単位数
- 対象木台帳がある場合の確認済み対象木数

### 4.3 Repeat coverage

- 異なる日付での確認
- 同じ集約単位への再訪
- 同じPlaceまたは同一候補木への再訪
- 季節または重点期間をまたぐ確認

同日・同一場所の連続投稿を、独立した反復調査として水増ししない。

### 4.4 Evidence quality

- 木全体
- 幹
- 根元
- 成虫
- フラス
- 脱出孔
- 被害兆候
- 写真の明るさ、ぼけ、遮蔽等の制限

通常投稿は自由形式のまま維持し、保存後にevidence coverageを評価する。

### 4.5 Freshness

- 最終記録日
- 最終`survey_usable`日
- 今季の重点期間内か
- protocolで定めた再訪期限を超えていないか

過去に十分な記録があっても、一定期間を過ぎたセルは`再確認時期`へ戻す。

### 4.6 Denominator

分母は明示的に区別する。

#### A. Known target denominator

例:

- 登録済み対象木100本のうち40本
- 公開公園20か所のうち12か所
- 管理台帳上の対象区画30区画のうち18区画

この場合に限り、対象範囲を明示して割合を表示できる。

#### B. Effort-only

対象木台帳等の信頼できる分母がない場合。

この場合は、Record数、異なる日数、反復、品質等から`調査努力の進み具合`を示す。地域全体の網羅率として百分率を表示しない。

## 5. Public states

公開セルは次の状態だけを使用する。

### `no_observations`

表示:

> まだ記録がありません

意味:

- 公開集計対象のRecordがない
- 対象木が存在しないという意味ではない

### `privacy_suppressed`

表示:

> 公開できる集計量に達していません

意味:

- Recordは存在する可能性がある
- 少数投稿の位置・行動を守るため詳細を表示しない

### `more_observation_useful`

表示:

> もう少し写真があると状況が分かります

意味:

- Recordはある
- 質、反復、異なる日、対象範囲等が不足している

### `observation_progressing`

表示:

> 調査が進んでいます

意味:

- 複数の確認条件が進んでいる
- 今季の基準はまだ全て満たしていない

### `current_target_met`

表示:

> 今季の確認基準を満たしています

意味:

- protocol versionで定めた条件を満たした
- 生息不在や安全を意味しない

### `revisit_due`

表示:

> もう一度確認したい時期です

意味:

- 過去の確認履歴はある
- protocolの鮮度条件を超えた

## 6. Deterministic classification

Area projection input:

```ts
interface KubiakaAreaCoverageInput {
  recordCount: number;
  photoCount: number;
  screenableRecordCount: number;
  surveyUsableRecordCount: number;
  uniqueSurveyDays: number;
  uniqueObservedUnits: number;
  repeatObservedUnits: number;
  lastObservedAt: string | null;
  lastSurveyUsableAt: string | null;
  asOf: string;
  publicMinRecords: number;
  target: {
    minimumSurveyUsableRecords: number;
    minimumUniqueSurveyDays: number;
    minimumRepeatObservedUnits: number;
    agingAfterDays: number;
    revisitAfterDays: number;
    minimumKnownTargetCoverageRatio?: number;
  };
  denominator?: {
    kind: "registered_target_units";
    totalTargetUnits: number;
    observedTargetUnits: number;
  };
}
```

判定順:

1. Record 0件なら`no_observations`
2. 公開閾値未満なら`privacy_suppressed`
3. 再訪期限超過なら`revisit_due`
4. protocol条件を全て満たせば`current_target_met`
5. 条件の半数以上が進んでいれば`observation_progressing`
6. それ以外は`more_observation_useful`

`current_target_met`には最低限、次を必要とする。

- `survey_usable`の最低件数
- 異なる日の最低数
- 再訪された対象単位の最低数
- known denominatorを使用する場合は最低確認率
- 鮮度条件内

通常写真が大量にあっても、`survey_usable`、異なる日、反復が不足していれば基準達成にしない。

## 7. Cell interaction

地図を開いた直後は、地域全体の状態を一目で見せる。

セルまたは地域を選ぶと、次を表示する。

```text
この範囲の見守り状況

調査が進んでいます

記録: 18件
確認に使える記録: 9件
異なる調査日: 3日
再訪された場所: 2か所
最終確認: 8日前

今季の基準まで
- 別の日の記録があと1日
- 同じ場所の再訪があと1か所

[このあたりを記録する]
```

分母がある場合:

```text
登録済み対象木 40本のうち 26本を今季確認
```

分母がない場合:

```text
地域全体の対象木数は未確定です。割合ではなく、集まった調査努力を表示しています。
```

## 8. Map layers

初期表示は`調査の進み具合`とする。

切替可能なレイヤー:

1. 調査の進み具合
2. 最終確認からの期間
3. 再訪状況
4. 写真の確認可能範囲
5. 確認・フィードバック状況
6. 確認済み候補の集約表示

未確認の候補や少数の候補を、赤い個別ピンで表示しない。

## 9. Visual and accessibility rules

- 色だけで状態を区別しない
- 塗り、線、模様、アイコン、ラベルを併用する
- 凡例を常時確認できる
- 文字200%でもセル詳細とCTAを操作できる
- keyboardとscreen readerで地域状態を巡回できる
- 地図が使えない場合は同じ情報を地域一覧で提供する
- `十分`という単語単体を使わず、`今季の確認基準を満たした`と表示する

## 10. Contributor motivation

ランキングや発見数競争を使わない。

選択したセルには、具体的な次の行動を一つ返す。

- この範囲はまだ記録がありません
- 木全体が分かる写真が役立ちます
- 別の日の記録があると比較できます
- 前回から時間がたったため再確認できます
- 今季の基準を満たしています。別の範囲も選べます

利用者の行動が地図へどう反映されたかを、事実として返す。

例:

> あなたの記録で、この範囲に7月の確認日が1日追加されました。

過剰な称賛、義務感、危険な場所への誘導は行わない。

## 11. Operator view

`/ops/kubiaka/coverage`では公開状態に加え、次を確認できる。

- raw countとdeduplicated count
- `photo_record` / `screenable_record` / `survey_usable`分布
- evidence role不足
- 同日・同地点の過剰集中
- reviewer coverage
- no-clear-sign判定の無作為監査率
- public suppression理由
- denominator sourceと更新日
- protocol version
- staleセル
- candidate集中地域

運営者が閾値を変更した場合、protocol versionを更新し、過去のprojectionを上書きせず再計算版を残す。

## 12. Data and versioning

保存するもの:

- aggregate unit identity
- projection time
- protocol version
- source watermark
- input counts
- denominator kind and source
- classified state
- missing conditions
- privacy suppression reason
- projection digest

同じ入力とprotocol versionから同じ結果を再現できること。

## 13. P0 acceptance criteria

- 発見地点ではなく調査coverageが初期表示される
- Record数だけで基準達成にならない
- 通常写真と`survey_usable`が分離される
- 異なる日と再訪が判定に含まれる
- 最終確認が古い地域は`revisit_due`になる
- 分母なしで網羅率を表示しない
- known denominatorの由来と対象範囲を表示する
- 少数投稿セルは統合または非表示になる
- exact coordinates、Record ID、子ども・学校・自宅・私有地を公開しない
- 色以外でも状態を識別できる
- 地図と同等の地域一覧を提供する
- 各セルで不足している次の一手が分かる
- 生息不在や安全を断定しない
