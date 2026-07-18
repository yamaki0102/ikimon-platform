# Public home UX completion gate

公開トップを含む利用者向け画面は、配備成功だけで「完了」と扱わない。

## 完了状態

1. `CODE_VERIFIED`
   - 型検査、ビルド、単体・回帰テストが成功
   - 実際の入れ子DOMを使った表示契約テストが成功
2. `STAGING_UX_VERIFIED`
   - immutable SHAをstagingへ配備
   - HTTP verifyと複数viewportのVisual QAが成功
   - 主要な見える操作部品を実クリックして成功
3. `PRODUCTION_DEPLOYED`
   - 承認済みproduction deployが成功
   - canonical URLとworkers.devのSHAが一致
4. `PRODUCTION_UX_VERIFIED`
   - productionの読み取り専用ブラウザQAが成功
   - この状態に達して初めて「本番反映完了」と報告する

`PRODUCTION_DEPLOYED`後にUX QAが失敗した場合は、`production_deployed_ux_not_verified`として扱う。直接本番を編集せず、修正PRからstaging検証をやり直す。

## 公開トップの必須確認

- PWA追加案内は初回公開トップに表示しない
- 「追加」「あとで」など孤立した操作部品がない
- ヒーローの主操作は1つ
- 320px、390px、1280px、1440pxで横スクロールがない
- 表示中のbutton、summary、`role=button`にアクセシブルネームがある
- 「写真を残す」でファイル選択が起動する
- モバイルメニューが開閉する
- 「近くの記録を見る」が地図へ遷移する
- production QAはGET・HEADのみ許可し、ファイル選択後のアップロードやDB書き込みを行わない

## 証拠

各releaseは次をSHAへ紐付ける。

- source SHAとruntime SHA
- Worker deployment identity
- HTTP smoke結果
- viewport別スクリーンショット
- layout、interaction、browser events
- production writeが0であること
- 最終release stage

スクリーンショット取得だけではVisual QA完了としない。意味不明な操作、無反応な操作、PCとスマホの情報優先順位も確認対象に含める。
