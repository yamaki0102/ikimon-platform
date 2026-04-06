# FieldScan App Polish Handoff

更新日: 2026-04-04
対象: ikimon FieldScan Android アプリ + ikimon.life 最小サーバー連携

## 目的

FieldScan を「Web の補助機能」ではなく、アプリ単体で観測開始・本人認証・オフライン保管・再送・テスト分離まで回る状態へ押し上げた。
次の担当エージェントは、ここから UI/UX の磨き込みと QA 体験の強化を進める。

## 現在の到達点

- `動作チェック` と `フィールド記録` を Android アプリ内で分離済み
- `動作チェック` は本番記録へ混ざらない
- 停止時クラッシュ修正済み
- `install_id` は端末側で自動発行され、未知 ID でもサーバーが自動受理する
- オフライン時は pending JSON として端末保管し、オンライン復帰時に再送する
- `反映状態` カードで `保存済み / 送信中 / 送信完了 / オフライン保管 / 再試行待ち / 送信失敗` を見られる
- Google ソーシャルログインを app-first で実装済み
- Google ログイン完了後、`ikimonfieldscan://auth/callback` でアプリへ戻り、app token を保存する
- Pixel 実機で Google ログイン成功確認済み
- Pixel 実機で `動作チェック` セッション送信成功確認済み
- `動作チェック` に `クイック / 標準 / ストレス` の 3 レベルを追加済み

## 実機で確認済みのこと

- Pixel 10 Pro
- パッケージ: `life.ikimon.fieldscan`
- インストール版: `0.8.1 (80002)`
- 停止後クラッシュなし
- pending queue は最終確認で `0`
- `fieldscan_upload_status.xml` は `state=uploaded`, `pending_count=0`, `last_session_intent=test`
- `field_observation_install_identity.xml` は `install_registered=true`
- Google ログインは「ikimon.life に飛ばされて終わる」状態から修正し、再試行でアプリへ戻ることを確認済み

## 重要な設計判断

### 1. app-only 優先

FieldScan の価値は「散歩のデータ価値をアプリで完結して返すこと」なので、Web プロフィール前提の認証や端末登録 UI はやめた。
認証は `app token + install_id` に分離している。

### 2. `install_id` は捨てていない

- `install_id`: 端末識別
- `app token`: 本人認証

これにより未ログイン利用、あとから本人統合、複数端末、オフライン再送を両立している。

### 3. テストは「隔離」優先

`動作チェック` は誤検出が出てもよい。
重要なのは本番の共同データを汚さないこと。
そのため `session_intent=test` と `official_record=false` を通している。

### 4. テスト強度を固定化

同じ「動作チェック」でも粒度が違うと比較不能になる。
そのため以下を追加した。

- `quick`: 停止・送信確認の最小テスト
- `standard`: 回帰比較の基準
- `stress`: 高頻度で誤検出・再送・負荷を見る

## 主な変更ファイル

### Android

- `mobile/android/ikimon-pocket/app/src/main/AndroidManifest.xml`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/ui/MainActivity.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/IkimonApp.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/api/AppAuthManager.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/api/InstallIdentityManager.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/api/ImmediateUploadDrainer.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/api/UploadCoordinator.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/api/UploadStatusStore.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/api/UploadWorker.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/api/NetworkState.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/pocket/FieldScanService.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/data/EventBuffer.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/data/DetectionEvent.kt`
- `mobile/android/ikimon-pocket/app/build.gradle.kts`

### Server

- `upload_package/public_html/api/v2/passive_event.php`
- `upload_package/public_html/api/v2/app_login.php`
- `upload_package/public_html/app_oauth_start.php`
- `upload_package/public_html/oauth_callback.php`
- `upload_package/libs/AppAuthTokenStore.php`
- `upload_package/libs/AppOAuthStateStore.php`
- `upload_package/libs/FieldScanInstallRegistry.php`
- `upload_package/libs/ContributionLedger.php`
- `upload_package/libs/GeoPlausibility.php`
- `upload_package/libs/PassiveObservationEngine.php`

## 現時点の未完事項

### 1. 停止直後の完了画面がまだ弱い

ホームへ戻って `反映状態` を見る方式なので、一段遅い。
停止直後に以下を返す画面が必要。

- 保存済み
- 送信済み
- オフライン保管
- 本番反映 / 動作チェック隔離
- テストレベル
- 除外件数

### 2. QA 情報が足りない

`geo_filtered_out` はサーバーで返っているが、アプリ側で見えない。
`動作チェック` の価値を上げるなら、停止後に以下を見せたい。

- イベント数
- 種候補数
- 除外件数
- 要検証件数
- 送信成否

### 3. テスト条件メモが UI にない

現状の `test_profile` は payload に乗るだけで、ユーザーが「今回の素材は YouTube / 室内実音あり / 屋外実地」などを書き分けられない。

## 次にやる順番

### Phase A: 停止後結果画面

目的:
停止直後にテストの成否が分かるようにする

優先タスク:
- `ScanActiveScreen` 停止後に result sheet を表示
- `UploadStatusSnapshot` を即時反映
- `test_profile` を表示
- `official / test` を視覚的に明示

### Phase B: QA 可視化

目的:
「テストしたが何が良くて何が悪かったか」がアプリだけで分かるようにする

優先タスク:
- `session_recap` 相当の軽量 QA JSON を test mode 用に返す
- `geo_filtered_out` 件数をアプリ表示
- `false positive っぽさ` を簡易指標化

### Phase C: 体験の磨き込み

目的:
FieldScan を道具ではなく継続利用できる観測体験へ寄せる

候補:
- アプリ内 `今回たまったデータ点`
- `今回埋めた観測枠`
- `地域全体の前進`
- オフライン中でも見える端末内 ledger

## Claude / 別エージェントへ渡す用の短い依頼文

```text
ikimon FieldScan アプリのブラッシュアップを引き継いでください。
作業ディレクトリは `C:\Users\YAMAKI\Documents\Playground` です。

前提:
- Android アプリは `life.ikimon.fieldscan`
- Google ソーシャルログインは app-first で実装済み
- `動作チェック / フィールド記録` 分離済み
- `動作チェック` は `quick / standard / stress` まで入っている
- オフライン保管と自動再送は動く
- Pixel 10 Pro 実機でログイン・送信成功確認済み

今回やってほしい主目的:
- 停止直後の結果画面を追加
- 動作チェック結果を QA しやすくする
- ホームへ戻らなくても `保存 / 送信 / 隔離 / 本番反映` が分かるようにする

重要:
- 目的は「種名を派手に出すこと」ではなく、「この散歩でどれだけデータが積まれたか」を返すこと
- テストは本番記録へ混ぜないこと
- `install_id` は端末識別、`app token` は本人認証なので両方残すこと
- 既存の pending / upload / oauth 導線を壊さないこと

最初に見るべき主要ファイル:
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/ui/MainActivity.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/pocket/FieldScanService.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/data/EventBuffer.kt`
- `mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/api/UploadStatusStore.kt`
- `upload_package/public_html/api/v2/passive_event.php`
- `upload_package/public_html/api/v2/session_recap.php`

最初の着手順:
1. 停止直後の result sheet を追加
2. test mode の QA 表示を追加
3. Pixel 実機で quick / standard / stress を各1回ずつ確認

完了時にほしい報告:
- 変更ファイル一覧
- 実機確認結果
- まだ残る UX 上の弱点
```
