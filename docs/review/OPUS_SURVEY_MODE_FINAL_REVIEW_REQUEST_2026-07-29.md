# ZUKAN 調査モード正本 — Claude Opus 最終レビュー依頼

## Review identity

- Repository: `yamaki0102/ikimon-platform`
- Review branch: `docs/survey-mode-canonical-plan-20260729`
- Request date: `2026-07-29`
- Review type: 実装前の正本・採否・段階計画の独立レビュー
- Mutation: 禁止。コード、文書、Issue、PRを変更しない

## 依頼

前回の独立レビューを受けて作成した調査モード正本が、現行repositoryの事実、ブラウザ制約、オフライン契約、科学的な努力量・不在セマンティクスと整合しているか、厳しく再レビューしてください。

こちらの案を肯定することを目的にしないでください。実装前に止めるべき誤り、過剰設計、既存資産の見落とし、Phase順序の誤りを優先して指摘してください。

## 最初に読む文書

1. `docs/spec/zukan-survey-mode-canonical-v1_2026-07-29.md`
2. `docs/review/opus-survey-mode-review-adoption_2026-07-29.md`
3. `docs/LIVE_GUIDE_DATA_LIFECYCLE.md`
4. `docs/spec/absence_semantics_v0_2026-06-11.md`

上記だけで判断せず、branch全体を検索し、現在の正本・実装・テスト・migrationを確認してください。

## コード探索の入口

- `platform_v2/src/ui/guideFlow.ts`
- `platform_v2/src/ui/guideFlow.test.ts`
- `platform_v2/src/routes/guideRead.ts`
- `platform_v2/src/routes/guideApi.ts`
- `platform_v2/src/services/guideSession.ts`
- `platform_v2/src/services/guideRouteTrack.ts`
- `platform_v2/src/services/guideSessionPublicSummary.ts`
- `platform_v2/src/services/absenceSemantics.ts`
- `platform_v2/src/services/contributionReceipts.ts`
- `platform_v2/src/services/mapEffort.ts`
- `platform_v2/src/services/observationEventEffort.ts`
- `platform_v2/src/appInstall.ts`
- `platform_v2/db/migrations/`
- `platform_v2/cloudflare_shadow/migrations/`
- guide/offline/vehicle/record feedback関連のunit・e2e
- `android-shell/`, `mobile/android/`, `mobile/ios/`

repository全体で次を検索してください。

`guide`, `fieldscan`, `SurveyLedger`, `visit_mode`, `movement_mode`, `effort_minutes`, `distance_meters`, `complete_checklist`, `target_taxa`, `offline`, `IndexedDB`, `outbox`, `consent`, `withdrawal`, `visibilitychange`, `pagehide`, `wakeLock`, `telemetry`, `geolocation`, `mesh`, `coverage`, `absence`, `non_detection`, `feedback`

## 特に検証してほしい事項

### 1. 正本の中心

`SurveyLedger`を端末内の第一級正本とし、送信待ちoutboxと分離する判断は妥当か。既存schema・serviceで代用できるものを重複実装していないか。

### 2. P0採否

採用した次のP0について、事実認識と最小改善策が正しいか。

- セッション終了後・再読込後のoffline replay
- IndexedDB queueの全件走査
- lifecycle/Wake Lock/background中断
- 不在セマンティクスの二重系統

前回指摘の誤読や過大評価があれば訂正してください。

### 3. オフライン契約

機内モードで開始・継続・終了・再読込し、翌日に同期する契約がブラウザ／PWAで成立するか。TTL、同意、撤回、期限切れ、部分同期、head-of-line blockingに穴がないか。

### 4. ブラウザ／ネイティブ境界

前面表示・画面点灯中のブラウザ版と、background取得・触覚を担うnative shellの境界は妥当か。既存shellを過大評価していないか。胸部・頭部・車載固定の製品表現に危険がないか。

### 5. モードと安全

`walk | stationary | open_ride | vehicle` と `driver | passenger` の分離は妥当か。渋滞・信号待ち・電車・低速移動を考慮しても、速度を補助に限定する判断は正しいか。driver UIに不足する安全条件がないか。

### 6. 稼働確認UX

標準は異常通知、正常通知は既定OFFの任意低頻度、画面には最終保存時刻を常設する判断は妥当か。音声記録との干渉、OS制約、通知疲れ、固定時の不安を踏まえ、より良い方式があれば提示してください。

### 7. 努力量と不在

取得方法・移動様式・時間・距離・日数・季節・精度を単一スコアへ合成しない判断は妥当か。受動調査を `insufficient_coverage` 相当に留める判断が既存正本と整合するか。

### 8. 調査量マップ

Stage A/Bを先行し、25〜50m内部カバーや撮影方向は実測後にする段階設計は妥当か。mesh ADR前に実装できる最小部分があるか、逆にADRだけでは不足する検証があるか。

### 9. Phase順序

Phase 0 → SurveyLedger → mode/UX/effort → mesh map → detailed navigation → native の順序は妥当か。分割・migration・API変更・テストをどの段階へ置くべきか。

### 10. 実装可能な粒度

正本が抽象的すぎないか、または過剰設計か。Phase 0を実装PRへ分解できる具体性があるか。実装前に追加すべきADR・データ契約・測定があれば列挙してください。

## 回答形式

日本語で、事実・推測・提案を明確に分けてください。コード事実にはファイルパスと行またはsymbolを付けてください。

1. 結論（10行以内）
2. 前回レビューから修正された点の評価
3. P0 / P1 / P2 findings
4. 正本の矛盾・不足・過剰設計
5. 採用／条件付き採用／保留／却下の再判定
6. 推奨する最終アーキテクチャ
7. 推奨するPhase順序と成功条件
8. Phase 0の具体的な実装PR分割案
9. 実装前に確定すべき未解決事項
10. 最終判定: `Freeze`, `Revise`, `Stop` のいずれか

`Freeze` は、実装中に通常の詳細調整があり得ることを認めつつ、正本・Phase順序・主要境界を変更せず実装へ進める場合です。

## 禁止

- コード、文書、branch、Issue、PRの変更
- commit、push、deploy
- DB・migration適用
- 依頼文だけを読んでrepository調査を省略すること
- 根拠なくブラウザまたはnativeの機能を保証すること
