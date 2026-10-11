# ZUKAN 調査モード native capability inventory

作成日: 2026-07-29  
目的: browser/native境界を、repository上の実装事実で確定する

## 1. 結論

既存native資産は存在し、ゼロからshellを作る必要はない。一方、胸部・頭部・車載固定での**background camera連続取得が本番利用可能な状態まで完成しているとは確認できない**。

現時点の境界:

- Android: background location/audio、foreground service、通知、振動、upload状態管理の資産あり
- Android camera/vision: foreground Activity前提の箇所があり、background camera保証は未確認
- android-shell: background location取得資産あり。camera/audioの統合調査runtimeではない
- iOS: camera/GPS統合engineの雛形あり。ただしcamera classificationはstub、audioはDEBUG simulation、upload先も現行正本との整合確認が必要
- 配布・署名・実機運用・production endpointの状態はrepositoryだけでは確定できない

したがって「nativeをPhase 5で新規追加する」でも「既存nativeで固定撮影が完成済み」でもない。正しくは、既存資産を棚卸し・統合し、Web正本と同じsession・consent・receipt契約へ接続する。

## 2. Android: ikimon-pocket

### 確認できた能力

`mobile/android/ikimon-pocket/app/src/main/AndroidManifest.xml`:

- fine/coarse location
- microphone
- camera
- vibration
- foreground service
- foreground location service
- foreground microphone service
- notification
- internet
- high sampling rate sensor

登録service:

- `PocketService`: `foregroundServiceType='location|microphone'`
- `FieldScanService`: `foregroundServiceType='location|microphone'`
- manifestコメントではvisionはforeground Activityで動作

`UploadStatusStore`:

- `idle | queued | offline_saved | uploading | uploaded | retrying | failed` 相当の状態
- pending count
- online状態
- install identityの有無・登録状態
- session intent
- 最終ファイル
- 「端末に保存」「通信復帰後に再送」の利用者向け文言

### 再利用判断

- foreground serviceとUploadStatusStoreは再利用候補
- install identityとupload receiptはWeb SurveyLedger/receiptとの整合対象
- vibrationはAndroid nativeの稼働確認・異常通知に使用可能
- background location/audioは既存責務を評価する

### 未確認・不足

- background cameraの継続取得
- OS制約下での長時間安定性
- current production APIとの契約整合
- queue itemとWeb session IDのidempotency連携
- Play配布・署名・version・利用者導線
- privacy/consent withdrawalのWeb共通契約との一致

## 3. Android: android-shell

`android-shell/.../FieldTrackingService.kt`で確認できたこと:

- Fused Location Provider
- 5秒要求、2.5秒最小更新
- high accuracy
- foreground notification
- `START_STICKY`
- sessionId/fieldId/stepCount
- recent 200 points
- local broadcastによるWeb/shellへの伝達

再利用判断:

- background route trackingの資産として有効
- camera、自然音、media queue、SurveyLedgerの完成実装ではない
- ikimon-pocketとの責務重複を整理し、2つのAndroid runtimeを並行発展させない

## 4. iOS: IkimonScan

`mobile/ios/IkimonScan/Sources/Scan/FieldScanEngine.swift`で確認できたこと:

- ARKit、CoreLocation、AVFoundation統合の構造
- camera/audio/GPS/LiDARのstate
- route point保持
- 1秒elapsed timer
- 4秒camera classification timer
- location update
- haptic feedback
- session終了時upload

未完成またはproduction非適格と判断する根拠:

- `classifyCurrentFrame()` はproduction implementation TODO
- audio detectionはDEBUG用simulation
- upload endpointとpayloadが現行platform正本か未確認
- background camera/audio/locationのcapability・entitlement・privacy表示が未確認
- offline queue、idempotent receipt、consent withdrawal、SurveyLedgerとの整合が未確認

再利用判断:

- UI/センサー統合のprototype資産
- 現時点で固定調査のproduction正本にはしない

## 5. 製品境界の決定

### Browser/PWA v1

正式成立条件:

- foreground
- screen on
- Wake Lock取得中または失効を検知可能
- hidden/pagehideで中断確定

提供可能:

- 手持ちの散歩
- 画面を点灯した固定ホルダー
- 定点観察
- passenger操作

保証しない:

- 画面ロック中のcamera継続
- background camera
- browser vibration
- OSによるタブ破棄後の取得継続

### Native convergence

既存native資産へ次を新規発明せず統合する。

- 共通 `surveySessionId`
- protocol/movement/operator vocabulary
- captured consent snapshot
- install/user ownership boundary
- idempotency receipt
- SurveyLedger state machine
- offline/drop/expiry status
- server-side distance/active duration calculation

### 固定撮影判断

- background location/audio: Android資産を検証後にnative beta候補
- background camera: 未完成として扱い、別のfeasibility gateを設ける
- iOS: prototypeからproduction化する計画を別途必要とする
- browser固定撮影はscreen-on限定で、実験提供以上の保証をしない

## 6. Phase順序への反映

### Phase 0-N: inventory verification

コード実装前に次をread-onlyまたはbuild/testで確認する。

1. ikimon-pocketのbuild可否
2. android-shellのbuild可否
3. iOS targetのbuild可否
4. production/staging endpoint
5. install identityとreceipt契約
6. foreground/backgroundの実機挙動
7.配布・署名状態
8. どのAndroid runtimeを正本にするか

### Native実装時期

- Phase 0-Nの棚卸しはPhase 0で実施
- WebのP0修正とSurveyLedger契約はnativeに依存せず進める
- native統合はPhase 2以降、mode/ledger/server contractが固定された後
- 胸部・頭部・車載background cameraを製品要件にする場合のみ、native camera feasibilityを独立gateにする

## 7. 判定

- 「native shellがない」: 誤り
- 「nativeで固定cameraが完成済み」: 根拠不足
- 「ブラウザのみでbackground固定cameraを保証できる」: 誤り
- 推奨: 既存native資産を共通調査契約へ収束させ、browserはforeground版として先行する