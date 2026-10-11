# ZUKAN 調査モード 正本 v1

作成日: 2026-07-29  
状態: 実装前・独立レビュー待ち  
対象repository: `yamaki0102/ikimon-platform`

## 1. 一文定義

ZUKAN調査モードは、散歩・定点観察・移動中に得られた調査時間、移動範囲、取得状態、代表記録を端末内へ確実に残し、通信復帰後に地域の調査状況へ反映する機能である。

中心はAIガイドでも自動識別でもなく、**調査した事実と努力量を失わず記録すること**である。

## 2. 機能の分離

次の3機能を独立させる。

1. **調査記録**: カメラ、自然音、位置、時間、個別記録、端末内保存、同期
2. **稼働確認**: 実際に取得・保存できているかの状態表示と異常通知
3. **調査ナビ**: 調査不足メッシュや不足軸の案内。AIガイドは任意の別レイヤー

調査記録は、稼働確認や調査ナビが無効でも成立しなければならない。

## 3. 現行ライブガイドの扱い

既存 `/guide` の取得基盤は再利用するが、製品上の主語を「ガイド」から「調査」へ変更する。

再利用対象:

- `platform_v2/src/ui/guideFlow.ts` にあるカメラ・音声・位置取得
- visual candidate、telemetry、自然音候補
- IndexedDB outbox
- `effortSummary` / `coverageSummary`
- `platform_v2/src/services/guideRouteTrack.ts` のvisit・軌跡保存
- `platform_v2/src/services/contributionReceipts.ts` の即時／遅延レシート設計
- `platform_v2/src/services/absenceSemantics.ts` の不在セマンティクス

再設計対象:

- 巨大なinline client script
- 開始導線
- モード語彙
- 調査中UI
- 終了処理
- オフライン再送契約
- 不在表現
- 調査努力量モデル
- 調査履歴と調査量マップ

AIガイド、TTS、次に見る対象の提案は調査成立条件から外し、任意機能とする。

## 4. 最優先原則

### 4.1 端末保存で調査成立

サーバー送信完了ではなく、端末内の `SurveyLedger` に確定記録された時点を調査成立とする。

### 4.2 終了操作は即時完了

終了押下後は新規取得と新規AI処理を止め、端末内データだけで結果を表示する。同期や追加解析を待たない。

### 4.3 取得方法を単一スコアへ合成しない

徒歩、定点、車両通過、自然音、個別記録は別軸で保持する。

### 4.4 受動記録を「探したが見つからなかった」にしない

対象分類群、努力量、完全チェックリストの条件を満たさない調査は、公開面では `insufficient_coverage` 相当とする。LLM由来の文章から不在を認定しない。

### 4.5 ブラウザで保証できないことを約束しない

画面ロック、バックグラウンド、OSによるタブ破棄中の連続撮影は保証しない。ブラウザ版は前面表示・画面点灯中を正式な成立条件とする。

## 5. SurveyLedger

送信待ちoutboxとは別に、IndexedDBへappend-onlyの調査台帳を持つ。

最低項目:

- `surveySessionId`
- `schemaVersion`
- `userId` または匿名端末識別子
- `mode`: `walk | stationary | open_ride | vehicle`
- `operatorRole`: `pedestrian | driver | passenger | fixed`
- `state`: `preparing | running | ending | ended | interrupted_background | interrupted_error`
- 開始、最終成功取得、終了、中断時刻
- カメラ、音声、位置の取得時同意snapshot
- 有効取得区間
- 端末内保存成功回数
- 代表フレーム数
- 個別記録数
- GPS点数、精度帯、推定距離
- 訪問した正本メッシュ候補
- 未送信件数・バイト数
- 同期状態
- 中断理由、期限切れ、削除理由

Ledgerは軽量データとしてメディアより長く保持する。メディアが期限切れになっても、調査が存在した事実と送れなかった状態を無言で消さない。

## 6. オフライン契約

### 6.1 再送条件

再送可否は、取得時同意snapshotと現在の恒久的な同意・撤回状態で判定する。`running` かどうかには依存させない。

### 6.2 head-of-line blocking禁止

再送不能itemがあっても後続itemを処理する。`deferred` で全drainを停止しない。

### 6.3 全件走査禁止

保存ごとにIndexedDBのblobを含む全件を `getAll()` しない。

- 件数・バイト数はインクリメンタルカウンタ
- 期限処理はindex cursor
- 同期は1件または小バッチ単位
- UIスレッド上で大きなblob一覧を展開しない

### 6.4 オフライン成功条件

機内モードで開始、調査、終了、結果表示、再読込が成立し、翌日に通信復帰して同期できること。

## 7. ライフサイクルと固定利用

### 7.1 ブラウザ版

- Screen Wake Lockを取得する
- `visibilitychange` で再取得または中断確定
- `pagehide` でLedgerへ最終checkpoint
- hidden時の継続撮影を約束しない
- 復帰時に中断時間を隠さず表示

胸部・頭部・車載固定は、画面を前面・点灯状態で保持できる場合に限りブラウザ版で利用可能とする。

### 7.2 ネイティブ境界

次を確実に提供する必要が生じた場合は、既存mobile shellへ責務を限定して追加する。

- 画面ロック中・バックグラウンドでの取得
- 確実な触覚通知
- 長時間固定撮影のOSレベル継続

解析、台帳、同期、フィードバックの正本はWeb共通基盤に残す。

## 8. 調査モード

### walk

散歩、犬の散歩、子どもとの散歩。一定時間または一定距離で候補を取得し、ブレ・暗所・重複を端末側で除外する。

### stationary

一地点を一定時間観察する。徒歩と混ぜない。距離ではなく継続時間、変化イベント、自然音候補を中心に記録する。

### open_ride

自転車、低速のオープン移動。同乗者または停止時の操作を前提にする。

### vehicle

車内、バス、電車等の通過記録。開始時に `driver` / `passenger` を選択する。

- driver: 走行中の操作要素、シャッター、案内を非表示
- passenger: 個別記録操作を許可可能
- 徒歩への自動切替はしない
- GPS速度は撮影頻度・重複排除・安全UIの補助のみ
- 渋滞、信号待ち、低速走行でもvehicleのまま扱う

## 9. 撮影・音声方針

### 自動取得

自動取得は調査範囲・環境状態の証拠であり、原則公開投稿にしない。

候補選択は以下の組合せで行う。

- 前回代表からの距離
- 経過時間
- 方位変化
- 画像差分
- ブレ
- 明るさ
- 位置精度
- モード

固定10秒だけに依存しない。取得間隔と保存間隔を分ける。

### 個別記録

調査中のシャッター、または徒歩・定点時の静止検知で個別候補を作る。個別記録は既存の豊かなフィードバックへ接続する。

車両driverでは静止検知・手動シャッターを無効とする。

### 自然音

自然音は任意。人の会話らしい区間を保存候補から除外する。稼働確認音を鳴らす場合は、その前後を解析対象外にする。

## 10. 稼働確認UX

AIは使わない。次を確認する。

- media trackがlive
- 直近に有効フレームを取得
- Ledgerまたはoutboxへの保存成功
- 位置更新
- 保存容量
- Wake Lockとvisibility

### 標準動作

- 開始時に明確な開始確認
- 画面上に「最終保存時刻」「端末内保存件数」「未同期件数」
- 異常時は既定で通知
- 正常時の定期音は既定OFF、任意で5分等を選択可能
- ブラウザ振動を必須機能にしない

異常例:

- カメラ停止
- 有効画像なし
- 位置更新停止
- 容量不足
- 画面非表示・Wake Lock解除
- Ledger保存失敗

## 11. UXフロー

### 開始前

主導線は「歩く」「置く」「自転車等」「車両」。AIガイドや詳細設定は副導線にする。2回目以降は前回設定を使い2タップ以内で開始できる。

### 調査中

表示は最小限とする。

- 調査中
- 最終保存状態
- 時間
- 距離または定点時間
- 通過メッシュ数
- 個別記録ボタン
- 終了

AI解析件数、音声チャンク、送信理由、候補カード一覧、インタラクティブ地図は主画面に出さない。

### 終了直後

Ledgerだけで即時表示する。

- 時間
- 距離
- 調査方法
- 通過メッシュ
- 有効保存数
- 個別記録候補
- 未同期状態
- 中断区間

### 後から

サーバー集計やAI結果は、予約済み領域または調査履歴へ静かに追加する。大きなレイアウト移動を起こさない。

## 12. 調査努力量モデル

単一スコアを作らず、最低限次の次元を保存する。

- acquisition: `automatic_frame | gps_transit | audio | manual`
- movement: `walk | stationary | open_ride | vehicle`
- active duration
- server-recomputed distance
- unique survey days
- participants
- season / time band
- position accuracy distribution
- visited stable meshes
- captured heading availability
- manual records
- complete checklist flag
- target taxa scope

クライアント申告距離は参考値に降格し、研究・集計用距離は軌跡からサーバー側で再計算する。

匿名・低精度・短時間・重複経路は内訳を保持し、同一人物・同一日・同一メッシュの日数を水増ししない。

## 13. 不在・非検出

正本は `platform_v2/src/services/absenceSemantics.ts` と関連specのみとする。

受動調査モードでは、対象分類群と完全チェックリストがないため、原則として不在・非検出を主張しない。

明示的な対象調査を実施する場合のみ、別のオプトインフローで以下を取得する。

- target taxa scope
- effortまたはdistance
- complete checklist confirmation

既存guide由来の `absenceBoundary` は公開表現の根拠にせず、内部の探索ヒントへ降格する。

## 14. 調査量マップ

500m程度の地域表示は段階導入する。

### Stage A

- 調査日数
- 調査時間
- 参加人数
- 最終調査日
- 移動様式別内訳

### Stage B

- 季節
- 時間帯
- 記録方法別の不足

### Stage C

GPS精度が十分な場合のみ、メッシュ内部の25〜50m程度の通過・撮影カバーを表示する。

### Stage D以降

- 撮影方向の偏り
- 道路・水路・公園・農地等との重ね合わせ
- 「この付近を見られるとよい」提案

Stage C以降はGPS精度・heading取得率の実測を前提とする。

### 正本メッシュ

既存の10m、100m、viewport相対gridへ4つ目を無条件追加しない。Stage A着手前にADRを作成し、グローバル対応、安定ID、集計性能、既存100mとの対応、公開時の秘匿性を比較して正本を決める。

## 15. 実装フェーズ

### Phase 0: 重大障害の解消

- 終了後・再読込後のoffline replay
- queue全件走査廃止
- visibility/pagehide/Wake Lock
- 不在セマンティクスの公開経路統一
- 停止後のレイアウト安定化
- 振る舞いをテスト可能な単位へ分割開始

成功条件:

- 圏外開始→終了→アプリ終了→翌日オンラインで全件同期
- 未送信期限切れを成功扱いせず表示
- background中断がLedgerへ残る
- 30分利用でqueue増加に比例したUI停止が起きない

### Phase 1: SurveyLedger

- IndexedDB schema追加
- append-only checkpoint
- local instant recap
- reload後の履歴復元

成功条件:

- 機内モードで開始から終了まで成立
- リロード後も調査履歴が残る
- サーバー・AIなしで終了結果が確定表示される

### Phase 2: モード・UX・努力量

- 4モード分離
- vehicle operator role
- モード別候補選択
- ブレ・暗所・重複filter接続
- server distance recompute
- telemetry batch化・認証境界
- 調査レシート

成功条件:

- 徒歩・定点・車両が別内訳になる
- driver走行中に操作を要求しない
- 個別記録が既存feedbackへ接続する

### Phase 3: 調査量マップ Stage A/B

- mesh ADR
- stable mesh集計
- 調査日・時間・人数・最終日・季節・方法

成功条件:

- 同一人物同日反復で調査日数が増えない
- 車両通過が徒歩調査を代替しない
- 公開画面に方法別不足を表示できる

### Phase 4: 詳細カバー・調査ナビ

実測結果を見てStage C以降を判断する。AIは最後の補助であり、GIS・統計・既存調査履歴を先に使う。

### Phase 5: ネイティブ補助

固定撮影の保証が製品要件になった場合のみ、background取得と触覚をshellへ追加する。

## 16. テスト正本

文字列一致だけでなく、少なくとも次を自動化する。

- offline stop/reload/next-day replay
- consent withdrawalと取得時snapshot
- queue cursorとbyte counter
- visibility interruption
- Wake Lock再取得
- 30分相当の長時間queue負荷
- walk/stationary/vehicleの分離
- driver UI safety
- server distance recompute
- absence semantics fail-closed
- instant recap layout stability
- IndexedDB reload recovery
- GPS低精度時の細粒度カバー非表示

端末実機:

- iPhone Safari/PWA
- Android Chrome/PWA
- 低〜中性能Android
- 圏外・通信断・復帰
- 画面ロック、別アプリ切替、OSメモリ圧
- 15分・30分・60分

## 17. 禁止事項

- P0未解消のまま調査モード利用を拡大しない
- `guideFlow.ts`へ機能を継ぎ足し続けない
- 受動通過を完全調査・非検出として表示しない
- 徒歩・定点・車両を単一スコアへ合成しない
- ブラウザでbackground継続を保証すると表現しない
- 同期失敗や期限切れを無言で成功扱いしない
- 500m正本決定前に既存meshへ場当たり的に追加しない

## 18. 実装開始判定

本正本は独立レビューで次を確認した後に凍結する。

1. P0認識とPhase順序が妥当か
2. SurveyLedgerとoutboxの分離が十分か
3. ブラウザ／ネイティブ境界が現実的か
4. 不在セマンティクスが正本と整合するか
5. effort modelに科学的・運用上の穴がないか
6. mesh ADRまでStage Aを保留する判断が妥当か
7. 既存schema・serviceで再利用できるものを見落としていないか
