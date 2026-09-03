# ZUKAN 調査モード 正本 v2

作成日: 2026-07-29  
状態: 実装前・Freeze再レビュー待ち  
対象repository: `yamaki0102/ikimon-platform`  
置換対象: `zukan-survey-mode-canonical-v1_2026-07-29.md`

関連正本:

- `docs/adr/zukan-survey-offline-lifecycle-contract-v1_2026-07-29.md`
- `docs/adr/zukan-survey-mode-vocabulary-v1_2026-07-29.md`
- `docs/review/zukan-survey-native-capability-inventory_2026-07-29.md`
- `docs/LIVE_GUIDE_DATA_LIFECYCLE.md`
- `docs/spec/absence_semantics_v0_2026-06-11.md`

## 1. 一文定義

ZUKAN調査モードは、散歩・定点・オープン移動・車両通過で得た**調査した事実と努力量**を端末へ確定保存し、通信・AIの成否から独立して利用者へ即時に返し、同期後に方法別の地域調査状況へ反映する基盤である。

中心はAIガイド、自動識別、写真投稿ではない。

## 2. 製品機能の分離

1. **調査記録**: camera/audio/location/time/manual record/local persistence/sync
2. **稼働確認**: 実際に端末保存できているか、異常・中断・未同期の表示
3. **調査ナビ**: 調査不足mesh・季節・方法の案内
4. **AIガイド**: 任意。上記3機能の成立条件にしない

調査記録は、稼働確認・調査ナビ・AIガイドが停止しても成立しなければならない。

## 3. 現行資産の正しい分類

### 再利用する正本データ・基盤

- camera/audio/location取得の一部
- visual candidate/telemetry queueの取得経路
- `ikimon-guide-offline-v1`: raw upload queue
- `ikimon-app-outbox-v1`: app-wide status/projection DBと既存UI
- `visits` / `visit_track_points`
- mobile field receipt/idempotency資産
- `contributionReceipts.ts` のimmediate/deferred claim設計
- `absenceSemantics.ts` のfail-closed公開判定
- `guide_environment_mesh_cells.grid_size_m`、contributor集計の既存構造
- 既存offline E2E harness
- Android/iOS/native shellの既存資産

### 正本データとして再利用しない

- `effortSummary` / `coverageSummary`: LLM prompt用文字列であり構造化努力量ではない
- `guideFlow.ts`のmemory-only `localCoverageCells`
- LLM由来 `absenceBoundary`
- viewport相対grid
- 既存単一effort classを新しい調査量へ流用すること

### 再設計対象

- 3,800行超のinline client runtime
- offline consent/replay/TTL/purge契約
- lifecycle/Wake Lock
- session ledger
- telemetry/sceneの認証・rate limit・install identity
- protocol/movement/operator/acquisition語彙
- active duration/server distance
- 不在3系統
- 調査中/終了後UX
- mesh正本と撤回可能な集計

## 4. 最優先原則

### 4.1 端末checkpointで調査成立

SurveyLedger session checkpointが端末へcommitされた時点を成立とする。送信・AI・公開は成立条件ではない。

### 4.2 終了は即時

終了押下後:

1. 新規取得・新規AI投入を停止
2. 残存telemetryを全点checkpoint/queue
3. camera/audio/locationを解放
4. local ledgerだけで結果を表示
5. 同期・解析は下位非同期処理

終了時にnetworkやAIを待たない。

### 4.3 方法を単一scoreへ合成しない

protocol、movement、operator、acquisition、duration、distance、accuracy、seasonを別次元で保持する。

既存 `classifyEffort` / `isSurveyQuality` / `absenceConfidence` は公開・研究・新mesh集計の正本にしない。

### 4.4 受動調査は不在ではない

対象分類群とcomplete checklistがない受動調査は、公開面でnon-detection/absenceを主張しない。

### 4.5 browser保証外を隠さない

browser版の正式条件はforeground、screen-on、lifecycle監視可能な状態。background cameraを保証しない。

## 5. 端末保存アーキテクチャ

### 5.1 Layer 1: runtime

短時間memory。状態の正本ではない。

### 5.2 Layer 2: raw queue

既存 `ikimon-guide-offline-v1`。

- frame/audio/exact route/payload
- TTL 72時間
- cursor/small batch/incremental counters
- capture consent/owner/idempotency

### 5.3 Layer 3: SurveyLedger

既存 `ikimon-app-outbox-v1` をDB version 2へ上げ、`survey_sessions` storeを追加する。新規DBは作らない。

Phase 1最小schema:

- session ID/schema version/owner boundary
- state/mode/operator
- start/checkpoint/end
- consent snapshot
- pending count/bytes
- sync state
- interruption/drop/expiry reason

Phase 2で距離・mesh・accuracy・heading・manual recordsを追加する。

### 5.4 稼働確認の正本

「記録できています」はLayer 3への直近checkpoint成功を意味する。AI解析成功やnetwork送信成功を意味しない。

## 6. Offline/consent/auth contract

詳細はoffline lifecycle ADRを正本とする。

決定:

- raw media/telemetry TTLは72時間
- E2E保証窓は48時間相当以内
- Ledgerは未同期sessionをapplication TTLで自動削除しない
- current consentはpersistent stateであり`running`ではない
- ordinary logout/auth expiryは`blocked_auth` quarantine
- same owner re-authでresume
- different ownerへ非表示・送信禁止
- explicit consent withdrawalでraw purge、Ledgerはredacted tombstone
- explicit local full deleteで全削除
- drainは`deferred`等でbreakしない
- syncは`/guide`限定にしない
- server receiptはidempotent

## 7. Lifecycle

- Wake Lock取得と失効監視
- `visibilitychange:hidden`で新規取得停止、`interrupted_background` checkpoint
- `pagehide`で最終checkpoint
- 復帰時に中断区間を表示
- hidden/background継続を約束しない
- browser storage evictionは検知可能な範囲で表示し、永久保持を保証しない

## 8. Browser/native境界

### Browser/PWA

提供:

- foregroundのwalk/stationary/open_ride/passenger
- screen-on固定ホルダー
- local ledger/offline queue/instant recap

保証しない:

- screen lock中のcamera
- background camera
- vibration
- OS tab discard後の継続

### Native

既存資産をゼロから作り直さない。

確認済み:

- Android ikimon-pocket: foreground location/audio service、vibration、upload status/install identity
- android-shell: foreground location tracking
- iOS IkimonScan: sensor integration prototype、ただしcamera/audio/uploadはproduction未完成箇所あり

判断:

- native capability inventory/build/distribution検証をPhase 0-Nで行う
- background location/audioは検証後のbeta候補
- background cameraは未完成として独立feasibility gate
- Web/Nativeは同じsession/consent/receipt/effort contractを使う

## 9. 語彙

詳細はmode vocabulary ADRを正本とする。

### protocol

`visit_mode`:

- `manual`
- `survey`

Guide利用は別metadata。legacy値はread projectionでnormalizeし、破壊的backfillを先に行わない。

### movement

`movement_mode`:

- `walk`
- `stationary`
- `open_ride`
- `vehicle`

### operator

- `pedestrian`
- `fixed`
- `driver`
- `passenger`

### acquisition

- `automatic_frame`
- `gps_transit`
- `audio`
- `manual`

## 10. モード別UX

### walk

散歩、犬、子どもとの散歩。一定時間・距離・景色変化から候補抽出。画面を見ないでも成立。

### stationary

一地点。距離ではなくactive duration、変化event、自然音、manual recordを返す。

### open_ride

自転車・低速オープン移動。停止時またはpassenger操作。vehicleと別内訳。

### vehicle

車内・バス・電車。渋滞でもvehicleのまま。

- driver: 操作要素、manual shutter、静止検知、案内を無効
- passenger: manual record許可可能
- speedはmode切替に使わない

Phase 2完了前の暫定安全策として、既存drive導線ではmanual shutter/操作要求を先に無効化する。

## 11. Capture policy

### 自動取得

capture intervalとretention intervalを分離する。

候補選択signal:

- elapsed time
- distance
- heading change
- image difference
- blur
- brightness
- position accuracy
- movement mode

blur/brightnessを計算するだけでなく、候補選択へ接続する。

### Manual record

walk/stationary/passengerでシャッターまたは明示操作。既存個別記録feedbackへ接続する。

### Audio

任意。speech-like chunkを保存候補から除外。正常確認音は標準OFF、異常通知を優先する。

## 12. 調査中・終了後体験

### 開始

主導線は4モード。AIガイドは副導線。再利用時は2タップ以内。

### 調査中

主画面:

- 調査中
- 最終checkpoint時刻
- local saved/pending count
- active duration
- distanceまたは定点時間
- manual record
- stop

出さない:

- AI処理件数
- audio chunk数
- queue内部理由
- 無制限候補cards
- interactive map

### 終了直後

Ledgerだけで確定:

- mode/active duration/distance参考値
- saved/pending/expired/interrupted
- manual candidates
- server未反映であること

遅延結果は予約済み領域へ追加し、layoutを押し下げない。

## 13. 努力量

構造化次元:

- protocol
- movement
- operator
- acquisition mix
- active duration
- wall-clock duration
- client reference distance
- server recomputed distance
- unique survey days
- participants
- season/time band
- accuracy distribution
- stable mesh visits
- heading availability
- manual records
- complete checklist
- target taxa scope

### Active duration

`first point -> latest point` のwall-clockを努力量にしない。hidden、中断、長時間gap、停止を除外してserver側で再計算する。

### Distance

client distanceは参考。研究・aggregateはaccepted track pointsからserver recompute。

### Anonymous boundary

匿名利用を許可する場合:

- `sessionId='anonymous'`を使用しない
- install-scoped identity + unique session ID
- same-origin/rate limit/size limit
- authenticatedとanonymousをaggregate内訳で区別

## 14. 不在・非検出

現行は三系統ある。

1. `absenceSemantics.ts`: fail-closed正本
2. guide/LLM `absenceBoundary`: denominatorなしで生成可能
3. `observationEventEffort.absenceConfidence`: effort classから数値化

目標:

- 公開・研究・調査量mapの唯一の入口は`deriveDetectionSemantic()`
- guide absenceBoundaryはinternal hintのみ
- guide public summaryからLLM不在文を切断
- auto-saveはLLM不在だけを保存理由にしない
- `absenceConfidence`はlegacy/internalへ隔離または廃止
- `insufficient_coverage` reasonを不足要因別に分ける

受動調査は原則`insufficient_coverage`。対象taxa、effort、complete checklistを明示取得した別flowのみnon-detection候補になる。

## 15. Telemetry/API境界

Phase 0で実施:

- `/api/v1/guide/telemetry`とsceneにsame-origin boundary
- rate limit/body size/item count
- install/user session identity
- `guide:anonymous`共有visit禁止
- idempotent point/scene receipt
- telemetry server writeをpointごとのtransaction/countからbatch処理へ変更する計画

Phase 2で実施:

- server active duration/distance recompute
- protocol/movement/operator normalization

## 16. Mesh・調査量map

### 現行meshは少なくとも4系統

- degree-based 100m-ish
- client 10m cos-corrected
- viewport-relative row:col
- `toFixed(4)` place mesh

加えて `guide_environment_mesh_cells` は `grid_size_m`、contributor countを既に持つ。

### Mesh ADR論点

ゼロから方式を増やすのではなく次を決める。

1. `(mesh_key, grid_size_m)`等のstable identity/primary key
2. 等積性・緯度依存
3. 負座標丸め
4. existing 100m/500m projection
5. sensitive location
6. withdrawal時のcontribution除外
7. global compatibility

### Stage A/B

- survey days
- active duration
- participants
- last survey
- movement/acquisition breakdown
- season/time band
- method-specific gap

同一人物・同日・同meshを日数1へ丸める。vehicleはwalkを代替しない。

### Stage C以降

GPS accuracyとheading実測後のみ25-50m internal coverage。道路・水路等のGIS、`regional_hypotheses`/sampling gap資産を再利用し、AIは最後に使う。

## 17. Phase順序

### Phase 0-A: 契約・抽出

1. offline/lifecycle ADRとmode ADRを凍結
2. native build/distribution/capability inventory
3. guideFlowのqueue/consent/lifecycleを振る舞い不変のTS moduleへ抽出
4. 現行bugを再現するbehavioral test

抽出を修正より先に行う。ただし既存drive安全の暫定縮退は独立小変更として先行可能。

### Phase 0-B: P0修正

- stop時flush順序、全telemetry flush
- persistent consent、auth quarantine
- replay/head-of-line/idempotency
- cursor/counter、enqueue blob read 0
- lifecycle/Wake Lock/checkpoint
- app-wide sync resume
- absence3系統の公開切断
- telemetry/scene security boundary
- instant recap layout stability

成功条件:

- offline stop/reload後48時間相当以内に全item同期
- 72時間TTL境界を正しくexpired表示
- logout/re-auth/owner mismatchが契約通り
- hidden中断を復元
- enqueue時blob read 0
- passive surveyからabsence公開なし
- shared anonymous visitなし

### Phase 1: SurveyLedger

- app outbox DB v2 / survey_sessions
- local checkpoint/state recovery
- instant recap
- app outbox UI統合

成功条件:

- airplane modeでstart/end/reload/history
- AI/serverなしで結果確定
- expired/drop/blockedを成功と混同しない

### Phase 2: Mode/effort/UX

- vocabulary normalization
- four movements/operator
- active duration/server distance
- acquisition mix
- candidate filters
- survey receipt/manual feedback
- research API normalization
- legacy score isolation

### Phase 3: Mesh Stage A/B

Mesh ADR/migration後に実施。withdrawal-aware aggregateを必須とする。

### Phase 4: Coverage/navigation

Accuracy/heading実測後。GIS/statistics first。

### Native convergence

Phase 0-Nで棚卸し、共通contract確定後に統合。background cameraは独立gate。

## 18. 実装PR分割

推奨依存順:

1. contract docs/native inventory
2. behavior-preserving module extraction
3. persistent consent/stop flush
4. replay/head-of-line/idempotency
5. cursor/counters
6. SurveyLedger projection
7. lifecycle/Wake Lock
8. absence public path
9. API security/anonymous identity
10. driver temporary safety
11. offline/lifecycle E2E
12. recap layout

1PRで巨大改修しない。抽出PRは振る舞い変更なしを受入条件とする。

## 19. Test正本

- stop -> queue -> reload -> <=48h resume
- 72h expiry boundary
- 13点以上telemetry final flush
- logout/re-auth/different owner/consent withdrawal
- enqueue blob read 0
- head-of-line continue
- idempotent replay
- visibility/pagehide/checkpoint
- Wake Lock loss/reacquire
- passive survey absence fail-closed
- anonymous install/session isolation
- 30/60分queue performance
- instant recap layout
- four movements/operator safety
- server active duration/distance
- research API normalized mapping
- withdrawal-aware mesh
- low accuracy Stage C suppression

実機:

- iPhone Safari/PWA
- Android Chrome/PWA
- low/mid Android
- network loss/recovery
- background/tab discard
- 15/30/60分
- native build/foreground/background capability

## 20. 禁止事項

- P0前の利用拡大
- inline scriptへの機能継ぎ足し
- passive surveyをabsence/non-detectionへ昇格
- protocol/movement/acquisitionの合成score
- browser background camera保証
- expiry/dropを成功表示
- shared `anonymous` visit
- mesh ADR前の場当たり500m追加
- legacy dataへの推測backfill
- native資産を未確認のまま完成扱い

## 21. Freeze条件

独立レビューで次を確認する。

1. TTL/logout/storage layer契約が矛盾しない
2. existing app outbox利用が過剰/不足でない
3. native inventoryとbrowser境界が事実に合う
4. mode mappingがresearch互換を守る
5. absence三系統の統合が漏れない
6. API securityとanonymous集約がPhase順序に入った
7. mesh既存資産・撤回・等積性が反映された
8. Phase 0が実装可能なPR単位へ分解されている

判定が`Freeze`になるまで機能実装へ進まない。ただし振る舞い不変のmodule抽出と現行bug再現testは並行着手可能とする。