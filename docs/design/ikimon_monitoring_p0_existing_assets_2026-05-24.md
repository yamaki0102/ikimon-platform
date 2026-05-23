# IKIMON Monitoring P0 Existing Assets Map - 2026-05-24

## 目的

`IKIMON Monitoring P0 Product Spec` を ikimon.life の既存実装へ接続するための対応表。

P0の実装方針は、DBを先に増やすことではなく、既存の記録、地図、品質、出力、フィールド情報を `契約エリアの継続運用OS` として束ねること。

## P0 Slice

今回の最小実装単位:

- `Area Coverage Read Model v0`
- 契約エリア内の記録を、位置と期間で動的にスコープする
- メッシュごとの記録量、候補/確定、努力量、季節カバーを計算する
- 正式報告、同定強化、エリア強化の出力準備度を分ける
- 5つの運用キューに戻す

実装:

- `platform_v2/src/services/monitoringWorkspaceReadModel.ts`
- `platform_v2/src/services/monitoringWorkspaceData.ts`
- `platform_v2/src/routes/monitoringWorkspaceApi.ts`
- `platform_v2/src/services/monitoringWorkspaceReadModel.test.ts`
- `platform_v2/src/routes/monitoringWorkspaceApi.routes.test.ts`

## Existing Assets

| P0要件 | 既存資産 | 接続方針 |
|---|---|---|
| 契約エリア内記録の自動抽出 | `areaPolygons.ts`, `pointInPolygon.ts`, `visits`, `occurrences`, `observation_fields` | `contract_area polygon x observation point` のread modelで抽出する。P0では永続紐づけを正本にしない |
| メッシュ/グリッド集計 | `mapEffort.ts`, `mapSnapshot.ts`, map API | 既存の地図集計思想を商用Monitoring用に分け、契約エリアのbbox/polygonに限定する |
| 確定/候補/根拠不足 | `monitoringRecordContract.ts`, `monitoringReadiness.ts`, `observationQualityGate.ts`, `observationRecordAiReview.ts` | `verificationState` と readiness blocker から運用キューを生成する |
| 位置情報制御 | `observationDataRights.ts`, `observationVisibility.ts`, `publicLocation.ts`, `civicContext.publicPrecision` | 顧客確認ビューと外部提出ビューを分け、`location_privacy_review` に戻す |
| フィールド重ね合わせ | `observation_fields`, `observationFieldRegistry.ts`, `areaPolygons.ts` | P0の正本はメッシュ。フィールドは説明レイヤーとして重ねる |
| 努力量 | `visits.effortMinutes`, `methodContext`, `waterRecord`, `mapEffort.ts` | P0では厳密プロトコルではなく、網羅性 + 努力量 + 記録量の近似で扱う |
| 季節カバー | `observed_at` | 月単位から軽く集計する。分類群別季節期待値はP1 |
| PDF/CSV出力 | `researchApi.ts`, `sampleReport.ts`, existing report outputs | P0では出力準備度と監査スナップショット設計を先に固定する |
| 監査ログ | `reportOutputs`, runtimeVersion, data product chain | 出力時スナップショットから始める。全操作イベントログはP1 |
| パートナー権限 | `reviewerAuthorities.ts`, session auth | P0ではworkspace単位 + 操作ロールへ発展させる。今回のread modelは権限判定を持たない |

## Read Model Contract

`monitoringWorkspaceReadModel` は、DB adapter から次を受け取る想定。

- workspace id / label
- contract term
- contract area bbox / polygon
- observation point
- `MonitoringRecordContractV0`
- 任意タグ / field ids

出力:

- summary KPI
- scoped records
- excluded records
- grid cells
- operation queues
- report readiness checklist

## P0 Acceptance Covered By This Slice

このsliceで固定できたもの:

- エリア内記録は動的空間検索で集める
- エリア集計と正式報告採用を分ける
- AI候補は同定強化に回し、正式報告へ自動混入させない
- メッシュカバー率と季節カバーを運用KPIにする
- 粗化/秘匿/未設定位置は `粗化確認` キューに戻す
- `正式報告 / 同定強化 / エリア強化` の3目的で準備度を分ける
- 管理者/分析担当または内部キー限定で、field_id 起点のread model APIを呼べる

## Not Covered Yet

次の実装で必要:

- `contract_area` first-class entity。今回のadapterは既存 `observation_fields` を契約エリア代替として使う
- UI: 運用キュー中心の `Monitoring Workspace v0`
- Export snapshot: PDF/CSV出力時の `audit_log_id` と対象記録ID保存
- Role gate: workspace単位 + 操作ロール

## Implementation Order

1. DB adapterを追加する
2. mockまたは実データで `Monitoring Workspace v0` を表示する
3. 出力スナップショットのテーブル/既存reportOutputs接続を決める
4. 権限ロールを実装する
