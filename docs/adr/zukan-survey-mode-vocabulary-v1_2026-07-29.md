# ZUKAN 調査モード 語彙・互換契約 v1

作成日: 2026-07-29  
状態: 正本 v2 の実装前契約

## 1. 問題

現行では `visit_mode` に観察プロトコルと移動様式が混在している。

確認済みの例:

- protocol寄り: `manual`, `survey`, `guided_survey`, `track`
- movement寄り: `walk_effort`, `vehicle_transect`
- UI内部: `walk`, `vehicle`
- mission内部: `quick`, `sound`, `spot`, `open_ride`, `drive`

このまま4モードを追加すると、研究出力・集計・既存行の意味が崩れる。

## 2. 正本次元

### 2.1 `visit_mode`: 観察プロトコル

新規writeの正本値:

- `manual`: 個別記録
- `survey`: 努力量を伴う調査session

`guided_survey` は新規writeでは使わず、`visit_mode='survey'` と `guide_used=true` に分離する。

`track` は既存互換値としてread可能とし、新規writeの用途は別ADRで必要性を確認する。

### 2.2 `movement_mode`: 物理的な移動様式

新規writeの正本値:

- `walk`
- `stationary`
- `open_ride`
- `vehicle`

速度から自動的に値を切り替えない。開始時選択を正本とし、速度は品質・撮影間隔・安全UIの補助signalに限定する。

### 2.3 `operator_role`: 操作者の安全上の役割

- `pedestrian`
- `fixed`
- `driver`
- `passenger`

`driver`では走行中に操作を要求するUI、手動シャッター、静止検知、音声案内を出さない。

### 2.4 `acquisition_mix`: 取得方法

単一値ではなく内訳を保持する。

- `automatic_frame`
- `gps_transit`
- `audio`
- `manual`

各keyは件数・active duration・保存成功数等の構造化値を持てる。`effortSummary` / `coverageSummary` の文字列を正本データにしない。

## 3. legacy normalization

既存行を破壊的に一括更新しない。read projectionで正規化する。

| legacy value | normalized visit_mode | normalized movement_mode | note |
|---|---|---|---|
| `walk_effort` | `survey` | `walk` | legacy sourceを保持 |
| `vehicle_transect` | `survey` | `vehicle` | operator role不明 |
| `guided_survey` | `survey` | existing movement or `walk` fallback | `guide_used=true` |
| `survey` | `survey` | existing movement | 正本候補 |
| `manual` | `manual` | existing movement or null | 個別記録 |
| `track` | `track` legacy | existing movement | 自動変換しない |

正規化関数を1か所に作り、research API、area snapshot、effort aggregation、public summaryが同じ関数を使用する。

## 4. write contract

Phase 2以降の新規調査write:

- `visit_mode='survey'`
- `movement_mode`を4値から必須指定
- `operator_role`を指定
- AI guide利用は `guide_used` またはsession metadataへ分離
- `client_reported_distance_meters` と server recomputed distanceを分離
- active durationとwall-clock durationを分離

## 5. backfill

- Phase 2では破壊的backfillを行わない
- legacy rowsはnormalized projectionで利用する
- backfillが必要な場合は、件数・研究出力差分・rollbackを含む別migration planを作る
- operator roleが推定不能な既存vehicle rowへ `driver` / `passenger` を推測で付与しない

## 6. research API

`researchApi`で `row.visit_mode === 'survey'` のような直接比較を増やさない。

- canonical normalization後のprotocolを使う
- legacy source valueを監査用に保持する
- mode変更前後でexport対象件数の差分テストを行う
- passive surveyをcomplete checklistやnon-detectionとして扱わない

## 7. 既存合成努力量

次は正本努力量ではない。

- `classifyEffort`
- `isSurveyQuality`
- `absenceConfidence`

Phase 2で公開・研究判定経路から隔離する。互換表示が必要な場合は `legacy_effort_class` と明示し、新しい調査量mapへ混ぜない。

## 8. 成功条件

1. stationaryがwalkへ潰れない
2. open_rideがvehicle通過と区別される
3. driver/passengerを推測で混同しない
4. legacy行を変更せず新旧を同一projectionで読める
5. research exportの対象変化がfixtureで説明可能
6. protocol、movement、operator、acquisitionを単一scoreへ合成しない