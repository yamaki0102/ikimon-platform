# ZUKAN 調査モード v2 — Freeze独立レビュー依頼

## Review identity

- Repository: `yamaki0102/ikimon-platform`
- Draft PR: `#1493`
- Branch: `docs/survey-mode-canonical-plan-20260729`
- Review type: 実装前の最終Freeze判定
- Mutation: 禁止

レビュー開始時にPR head SHAを取得し、回答冒頭へ記載してください。この文書の作成後にも同一branch内の文書commitが追加される可能性があるため、promptに書かれた過去SHAではなく、取得したcurrent headを正本としてください。

## 1. 最初に読む正本候補

1. `docs/spec/zukan-survey-mode-canonical-v2_2026-07-29.md`
2. `docs/adr/zukan-survey-offline-lifecycle-contract-v1_2026-07-29.md`
3. `docs/adr/zukan-survey-mode-vocabulary-v1_2026-07-29.md`
4. `docs/review/zukan-survey-native-capability-inventory_2026-07-29.md`
5. `docs/review/opus-survey-mode-second-review-adoption_2026-07-29.md`
6. `docs/LIVE_GUIDE_DATA_LIFECYCLE.md`

v1文書と第1回レビュー採否は経緯として読み、v2と上記ADRを優先してください。

## 2. 背景

第2回Opusレビューは`Revise`判定でした。主な理由は次の5点です。

1. telemetry TTL 24時間と翌日全件同期の矛盾
2. logout purgeとSurveyLedger保持の衝突
3. Ledger実装が既存App outbox資産を見落としていた
4. native資産の棚卸し不足
5. protocol/movement/operator語彙とresearch互換が未確定

v2ではこれらを決定済みとして正本化しました。

## 3. 今回の決定

### Offline/TTL

- raw media/telemetry: 72時間
- automatic E2E guarantee: 48時間相当以内
- Ledger: 未同期sessionをapplication TTLで自動削除しない
- expiryはLedgerへ明示

### Auth/consent

- ordinary logout/auth expiry: `blocked_auth` quarantine
- same owner re-auth: resume
- different owner:不可視・送信禁止
- explicit consent withdrawal: raw purge + redacted tombstone
- explicit full local delete:全削除

### Ledger

- 新規IndexedDB databaseは作らない
- existing `ikimon-app-outbox-v1`をv2へ上げる
- existing `items`とは別に`survey_sessions` storeを追加

### Native

- existing assetsは再利用候補
- Android background location/audioとvibrationは資産あり
- background cameraは完成済み扱いしない
- iOSはstub/simulation/legacy endpointを含むprototype
- browserはforeground/screen-onのみ保証

### Vocabulary

- `visit_mode`: protocol
- `movement_mode`: four movements
- `operator_role`: safety role
- acquisition:別次元
- destructive backfillなし、read normalization

## 4. Repository探索

この文書だけで判断せず、repository全体を検索してください。最低限、次を確認してください。

### Web/client

- `platform_v2/src/ui/guideFlow.ts`
- `platform_v2/src/ui/guideFlow.test.ts`
- `platform_v2/src/ui/siteShell.ts`
- `platform_v2/src/routes/pwa.ts`
- `platform_v2/src/appInstall.ts`
- offline E2E

### Server/data

- `platform_v2/src/routes/guideApi.ts`
- `platform_v2/src/services/guideRouteTrack.ts`
- `platform_v2/src/services/guideSession.ts`
- `platform_v2/src/services/guideSessionPublicSummary.ts`
- `platform_v2/src/services/guideAutoSave.ts`
- `platform_v2/src/services/absenceSemantics.ts`
- `platform_v2/src/services/observationEventEffort.ts`
- `platform_v2/src/routes/researchApi.ts`
- `platform_v2/src/services/contributionReceipts.ts`
- related migrations/receipts/mesh tables

### Native

- `mobile/android/ikimon-pocket/`
- `android-shell/`
- `mobile/ios/IkimonScan/`

### Search terms

`currentGuideConsentSnapshot`, `capturedConsentSnapshot`, `running`, `flushTelemetryBuffer`, `getAll`, `ikimon-app-outbox-v1`, `survey_sessions`, `logout`, `consent reset`, `absenceBoundary`, `absenceConfidence`, `deriveDetectionSemantic`, `visit_mode`, `movement_mode`, `classifyEffort`, `guide:anonymous`, `grid_size_m`, `contributor_hashes`, `receipt`, `idempotency`, `PocketService`, `FieldTrackingService`, `FieldScanEngine`

## 5. 最重要の質問

1. TTL 72h + guarantee 48h + Ledger非自動削除は、offline価値とprivacyの境界として矛盾していないか。
2. logout/auth quarantine設計はshared deviceで前所有者情報を漏らさず、同じ所有者の復帰を可能にできるか。
3. existing App outbox DB内の別storeは、新DBより妥当か。既存DB contractやversion upgradeに致命的問題がないか。
4. SurveyLedger Phase 1最小schemaは過不足ないか。
5. native inventoryは資産を過大・過小評価していないか。
6. background cameraを独立gateにした判断は妥当か。
7. mode normalizationは既存research export・snapshot・legacy rowsを壊さないか。
8. 不在三系統の統一範囲に漏れがないか。特にauto-saveと公開summary。
9. `/telemetry`/`scene` security、shared anonymous visit、idempotencyをPhase 0へ置いた判断は十分か。
10. existing mesh資産とwithdrawal-aware aggregationを正しく評価しているか。
11. behavior-preserving extractionをP0修正より先に置く順序は安全か。
12. Phase 0のPR分割で、独立にmergeできない隠れた依存がないか。

## 6. 特に探す反証

- v2の決定を不要にする既存実装
- App outbox DB version upgradeで既存itemsを失う可能性
- auth quarantineでは解決できないownership問題
- raw telemetry 72hが既存privacy/legal contractと両立しない根拠
- Ledgerをserver receiptから復元できるためlocal session storeが不要となる根拠
- existing nativeでbackground cameraがproduction-readyである証拠
- 逆に、native資産が再利用不能である証拠
- protocol/movement分離が既存schemaで表現不能な根拠
- mesh aggregateからwithdrawn userを除外不能な構造
- absenceの第4系統または公開経路の見落とし

## 7. 回答形式

日本語で、次の順に回答してください。

1. 結論（10行以内）
2. Review identity / exact SHA
3. v1 `Revise`条件が解消されたかの表
4. P0/P1/P2 findings
5. Offline/TTL/auth contract判定
6. SurveyLedger/app outbox判定
7. Native境界判定
8. Mode/research互換判定
9. Absence/effort/mesh判定
10. Phase/PR分割判定
11. Freeze前に残る未解決事項
12. 最終判定: `Freeze | Revise | Stop`

各findingは次を含めてください。

- 【事実】【推測】【提案】の区別
- repository path
- lineまたはsymbol
- 実際に起こる失敗
- 最小改善策

## 8. 判定基準

### Freeze

実装を止める契約矛盾・P0見落とし・既存資産の重大な誤認がなく、残件が実装中の通常詳細に限られる。

### Revise

正本、ADR、Phase成功条件の変更が必要。

### Stop

根本方針が実現不能・危険・既存基盤と非互換。

## 9. 禁止

レビューのみ実施してください。

- code/document変更
- commit/push
- PR/Issue作成・編集
- migration/DB変更
- deploy/production mutation

cloneやscratchpad上のread-only調査は可です。