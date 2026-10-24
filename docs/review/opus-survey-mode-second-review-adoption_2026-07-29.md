# ZUKAN 調査モード 第2回Opusレビュー採否

作成日: 2026-07-29  
対象: PR #1493 / canonical v1への`Revise`判定

## 1. 判定の受領

第2回レビューの最終判定`Revise`を採用する。

根本方針は維持する。

- AIガイドを調査成立条件から外す
- 端末checkpointで調査成立
- 方法別努力量を合成しない
- 受動調査を不在にしない
- P0修正をUI拡張より先に行う

ただし、v1は既存資産・契約・不在系統・API境界の把握が不十分だったためv2で置換する。

## 2. 必須5項目の決定

### D-01 TTL

**決定**:

- raw media: 72時間
- raw telemetry: 24時間から72時間へ変更
- E2E guarantee window: 48時間相当以内
- SurveyLedger: 未同期sessionをapplication TTLで自動削除しない
- 同期済みlocal history: 90日初期保持を目標

採用理由:

24時間では翌日境界で成立しない。raw正確位置を無期限保持せず、Ledgerでexpiryを正直に残す。

### D-02 logout / consent

**決定**:

- ordinary logout/auth expiry: raw queueとLedgerを削除せず`blocked_auth` quarantine
- same owner re-auth: resume
- different owner:不可視・送信禁止
- explicit consent withdrawal: raw purge、Ledger redacted tombstone
- explicit full local delete:全削除

採用理由:

無言消去とshared-device privacyの両方を避ける。

### D-03 SurveyLedger実装

**決定**:

新規IndexedDB databaseは作らない。既存`ikimon-app-outbox-v1`をversion 2へ上げ、既存`items`とは別の`survey_sessions` storeを追加する。

Opus提案の「既存items storeへそのまま混ぜる」は条件付き採用とする。itemsは送信projection、survey_sessionsはsession state machineで責務が異なるため、同一DB・別storeが最小の分離である。

### D-04 native境界

**決定**:

既存native資産をPhase 0で棚卸しし、Phase 2以降に共通contractへ収束する。

- Android background location/audio、vibration、upload status資産は再利用候補
- background cameraは完成済みと扱わない
- iOSはprototype/stubを含みproduction正本と扱わない
- browser固定利用はforeground/screen-on限定
- background cameraは独立feasibility gate

### D-05 mode mapping

**決定**:

- `visit_mode`: protocol (`manual | survey`)
- `movement_mode`: `walk | stationary | open_ride | vehicle`
- `operator_role`: `pedestrian | fixed | driver | passenger`
- acquisition mixを別次元
- destructive backfillは行わずread projectionでlegacy normalize
- research APIはdirect string比較からnormalizationへ移行

## 3. Findings採否

### P0-01 final telemetry false consent/drop

**採用・v2で強化。**

- stop順序を`flush/checkpoint -> running=false`へ変更
- 13点以上の残存bufferを全点flush
- final batchのcapture consentを停止前stateから取得
-回帰testをPhase 0必須にする

### P0-02 reload drain blocked

**採用。** persistent consentとapp-wide syncへ変更。

### P0-03 TTL矛盾

**採用。** D-01で決着。

### P0-04 logout purge衝突

**採用。** D-02で決着。

### P0-05 absence三系統

**採用。** v2で三系統を明記。

1. `absenceSemantics`
2. guide/LLM absenceBoundary
3. `observationEventEffort.absenceConfidence`

公開・研究入口を1へ統一し、2はhint、3はlegacy/internal隔離または廃止。

### P0-06 absence降格とauto-save

**採用。** guide auto-saveはLLM不在だけを保存理由にしない。代替理由はenvironment/visual/manual/explicit target surveyへ限定する。

### P0-07 telemetry/scene security

**採用・Phase 0へ追加。**

- same-origin
- rate/body/item limit
- install/user identity
- shared `guide:anonymous`禁止
- idempotent receipts

### P0-08 `/guide`限定drain

**採用。** app-wide resumeへ変更。Background Syncは補助。

### P1-01 queue full scan x3

**採用・測定条件追加。** enqueue時blob read 0 byte。

### P1-02 effortSummary/coverageSummary誤認

**採用。** v2の再利用正本から削除。LLM prompt互換文字列に限定。

### P1-03 active duration

**採用。** server distanceだけでなくactive durationもtrack points/gapsから再計算。

### P1-04 existing composite effort

**採用。** 将来禁止ではなく既存公開・研究経路から隔離/廃止をPhase 2へ追加。

### P1-05 four mode/server vocabulary

**採用。** D-05で決着。legacyはprojection normalize。

### P1-06 driver safety

**採用。** Phase 2を待たずdrive導線のmanual shutter/静止検知/操作要求を暫定無効化。

### P1-07 research API

**採用。** normalization functionを共通化し件数差分test。

### P1-08 existing E2E

**採用。** harness再利用。stop/reload/expiry/logout/owner casesを追加。

### P1-09 lifecycle zero

**採用。** existing siteShell capture stop patternを参考にする。

### P2-01 mesh four systems

**採用。** v2で4系統へ訂正。`guide_environment_mesh_cells.grid_size_m`を再利用候補に追加。

### P2-02 insufficient reason

**採用。** insufficient_coverage reasonをtarget/effort/checklist/passive/accuracy等へ分岐。

### P2-03 deletion aggregate

**採用。** withdrawal-aware aggregateをStage Aの成立条件へ追加。

## 4. 過剰設計指摘への対応

### O-1 Ledgerが4つ目の台帳

**採用。** 新DB案を撤回。同一App outbox DB内別storeとする。

### O-2 nativeは既に存在

**採用。ただし「完成済み」評価は却下。**

repository上に資産はあるが、Android camera background、iOS production implementation、endpoint、配布状態は未確定。native inventory文書で能力とgapを分離した。

### O-3 mesh ADR範囲

**採用。** 新方式選定ではなく、primary key/grid size/equal-area/negative coordinate/withdrawal/global互換へ絞る。

### O-4 Ledger項目過多

**採用。** Phase 1最小schemaへ縮小し、effort詳細はPhase 2へ延期。

## 5. Phase順序の変更

v1:

P0修正の末尾でmodule分割開始。

v2:

1. 契約ADR/native inventory
2. 振る舞い不変module extraction
3. bug reproduction tests
4. P0 fixes
5. SurveyLedger
6. mode/effort/UX
7. mesh

A-09をP0先頭へ格上げする。

## 6. 未採用・修正採用

### 新規DBを作る

**却下。** existing App outbox DB v2に統合。

### existing app outbox `items` storeだけでsession ledgerを表現

**修正採用。** 同一DBの`survey_sessions` storeに分離。

### nativeで固定cameraが実現済み

**却下。** asset存在とproduction readinessを分ける。

### 500mを新規独自meshとして追加

**却下。** existing size-aware mesh tableと4系統をADRで整理後に投影。

## 7. v2 Freezeレビューで確認すること

1. D-01〜D-05が既存コードと矛盾しないか
2. App outbox同一DB・別storeが適切か
3. auth quarantineがshared-device privacyを守るか
4. telemetry 72hがprivacyとoffline価値の妥当な境界か
5. native inventoryの評価が過小・過大でないか
6. mode normalizationでresearch populationを壊さないか
7. absence三系統の切断漏れがないか
8. Phase 0 PR分割が安全に実装可能か

## 8. 現在のゲート

- canonical v1: superseded
- canonical v2: Freezeレビュー待ち
- source implementation: 未開始
- behavior-preserving extraction: Freezeと並行着手可能だが、このPRでは未実施
- DB/migration/deploy/production change: 0