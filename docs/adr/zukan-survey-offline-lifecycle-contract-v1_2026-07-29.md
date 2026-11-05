# ZUKAN 調査モード オフライン・ライフサイクル契約 v1

作成日: 2026-07-29  
状態: 正本 v2 の実装前契約  
対象: Web/PWA、既存 mobile shell、サーバー同期

## 1. 目的

通信断、終了、再読込、認証失効、同意撤回、ブラウザ中断が発生しても、利用者へ成功したように見せたまま調査を失わない。

本契約は `docs/LIVE_GUIDE_DATA_LIFECYCLE.md` の現行実装契約を置き換える目標契約である。Phase 0 のコード反映が完了するまでは、現行runtimeがこの契約を満たしているとは扱わない。

## 2. 保存層

### Layer 1: Capture runtime

- メモリ上のカメラ、音声、位置、候補、短時間バッファ
- `visibilitychange`、`pagehide`、明示終了、エラーで必ずcheckpointを試行する
- Layer 1だけに存在する情報を調査成立の根拠にしない

### Layer 2: Raw upload queue

既存 `ikimon-guide-offline-v1` を、メディア・正確な位置・送信用payloadの一時キューとして維持する。

- scene、audio、telemetryを保持できる
- blob込みの全件 `getAll()` をenqueue経路で禁止する
- cursor、小バッチ、インクリメンタル件数・バイト数を用いる
- itemは取得時同意snapshot、所有者境界、idempotency keyを持つ
- 同期成功、明示削除、TTL、同意不一致の各状態を区別する

### Layer 3: SurveyLedger

新しいIndexedDBデータベースは作らない。既存 `ikimon-app-outbox-v1` をversion 2へ上げ、既存 `items` storeとは別に `survey_sessions` storeを追加する。

理由:

- `items` は送信項目のprojectionであり、セッションのappend-only状態遷移を無理に混在させない
- 既存DB、変更イベント、App outbox UI、source/status集計を再利用できる
- 4つ目の端末台帳を作らない

`survey_sessions` のPhase 1最小項目:

- `surveySessionId`
- `schemaVersion`
- `ownerSubjectHash` またはinstall-scoped匿名識別子
- `state`: `preparing | running | ending | ended | interrupted_background | interrupted_error`
- `mode`、`operatorRole`
- `startedAt`、`lastCheckpointAt`、`endedAt`
- 取得時同意snapshot
- `pendingItemCount`、`pendingBytes`
- `syncState`
- `interruptionReason`
- `expiryOrDropReason`
- `createdAt`、`updatedAt`

距離、GPS精度分布、visited mesh、heading、代表フレーム数等はPhase 2で追加する。Phase 1の復元要件に不要な項目を最初から固定しない。

## 3. 調査成立

調査成立は、Layer 3へsession checkpointがcommitされた時点とする。

- サーバー送信、AI解析、Layer 2の全メディア保存は成立条件ではない
- Layer 3保存失敗時は「記録できています」と表示しない
- Layer 2が期限切れでも、Layer 3には `expired_unsent` 等の結果を残す
- ブラウザやOSによる予測不能なstorage evictionは保証できないため、persistent storage取得状況を表示し、保証外を隠さない

## 4. TTL

### 決定

- media-bearing queue item: 72時間
- telemetry-only raw item: **72時間へ統一**
- SurveyLedger: application TTLで未同期sessionを自動削除しない
- 同期済みのローカル履歴: 90日を初期表示保持期間とし、利用者が延長・削除できる設計を目標とする

理由:

- 24時間では翌日利用の境界で軌跡が失われる
- 72時間は週末・翌日復帰を現実的に扱いつつ、正確な位置の長期露出を避ける妥協点
- 72時間を超えた場合もLedgerは「送れなかった調査」として残し、成功扱いしない

### テスト保証窓

Phase 0の自動E2E保証は、圏外終了から**48時間相当以内**の再開でscene/audio/telemetryが欠落なく同期することとする。72時間境界の前後は別のTTLテストで検証する。

## 5. 同意と認証

### 取得時同意

各Layer 2 itemとLayer 3 sessionは、取得時のcamera/audio/location同意snapshotを保持する。

### 現在同意

「現在同意」は永続的な同意・撤回stateを意味し、`running`や画面表示中かどうかを意味しない。

再送条件:

- 取得時同意がある
- 現在の永続同意が撤回されていない
- 所有者またはinstall identityが一致する

### 認証失効・ログアウト

通常ログアウトやcookie失効で調査事実を無言削除しない。

- Raw queue: `blocked_auth` として隔離し、送信しない
- SurveyLedger:保持するが、別ユーザーには表示・送信しない
- 同じ所有者が再認証した場合のみ再送可能
- 別ユーザーでログインした場合、前所有者のsessionは不可視のまま隔離

### 明示的同意撤回・端末データ削除

- 同意撤回: 該当raw media/telemetryを削除し、Ledgerを最小tombstoneへredactして `purged_consent_withdrawal` を残す
- 「この端末の調査データをすべて削除」: Raw queueとLedgerを完全削除する
- 公開済み・サーバー保存済みデータは既存の削除・匿名化cascadeを実行する

## 6. 同期

- `deferred`、`blocked_auth`、同意不一致、破損itemで後続同期を止めない
- itemごとの結果を `uploaded | deferred | blocked_auth | expired | dropped_consent_mismatch | failed_retryable | failed_terminal` で記録する
- 同一itemの再送はidempotentでなければならない
- client item ID、session ID、install IDをサーバーreceiptのunique境界へ結合する
- Layer 2削除時に既存App outbox projectionを消すのではなく、最終statusへ更新してからcompactする

## 7. 同期起動面

同期は `/guide` ページに依存させない。

- app shellが読み込まれる任意のページで未同期数を確認し、同期要求を出せる
- Service Worker Background Syncは補助であり、唯一の送信経路にしない
- Service Workerはwindow clientへの通知だけでなく、利用可能な範囲で同期開始を仲介する。ただし未対応ブラウザでは次回app起動時に再開する
- UIには「端末に保存済み」「認証待ち」「再送中」「送信済み」「期限切れ」を区別して表示する

## 8. ブラウザライフサイクル

- Screen Wake Lockを取得し、失効を監視する
- `visibilitychange`でhiddenになったら新規取得を止め、`interrupted_background` checkpointを確定する
- `pagehide`で最終checkpointを試行する
- 復帰時に中断区間を隠さない
- browser版はforeground・screen-on以外の継続取得を保証しない

## 9. 削除と集計

- exact route、raw media、個人・installへ再結合できるsessionデータは撤回時に削除または匿名化する
- mesh aggregateを残せるのは、個人・install・exact route・元recordへ不可逆に再結合できない場合のみ
- 参加人数・調査日数を再計算可能なaggregateは、撤回済みcontributionを除外できるprovenanceを内部に保持する
- 公開aggregateと内部削除provenanceを同一公開payloadへ含めない

## 10. Phase 0成功条件

1. offlineで開始・終了し、48時間相当以内に任意のapp pageを開くと全itemが同期する
2. 終了時telemetryがfalse consent snapshotでdropされない
3. 13点以上のtelemetry bufferも全点flushされる
4. enqueue時のblob読み出しが0バイトである
5. 期限切れ・同意不一致・認証待ちがLedgerへ残る
6. logout/cookie失効で別ユーザーへ漏れず、同じユーザーの再認証で再開できる
7. hidden/pagehide時に中断checkpointが残る
8. retry後もserver recordが重複しない

## 11. 現行契約からの移行

`docs/LIVE_GUIDE_DATA_LIFECYCLE.md` の次の現行条項はPhase 0で更新する。

- telemetry TTL 24時間 → 72時間
- current consent = running中 → 永続同意state
- logoutで全queue purge → auth quarantine、明示撤回でpurge
- `/guide`限定drain → app-wide resume

コードが更新されるまでは、このADRはtarget contractでありruntime evidenceではない。