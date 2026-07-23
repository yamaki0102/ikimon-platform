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
- ログイン前とログイン後は `state-split-home-v1` の別レイアウトであり、同じフィードの並べ替えにしない
- ログイン前は価値理解、公開記録、位置保護、最初の記録だけを担当し、ヒーローの主操作は1つ
- ログイン後は気軽な記録、最近の自分の記録、実在する発見、他者の安全な公開記録だけを担当する
- ログイン後ホームで再訪、継続調査、連続記録、モニタリングを主要行動として要求しない
- 推薦read modelがない段階では「おすすめ」「人気」「ランキング」を表示しない
- 自分の最新記録、別の発見記録、近隣公開記録のrecord IDが重複しない
- 発見、近隣、自分の記録がない場合は、空の大型カードではなくセクション自体を省略する
- 動画は自動再生せず、音声とメモは画像なしでも意味が通る
- ログイン前に固定下部ナビを出さず、ログイン後だけ `ホーム / 記録 / 見つける / マイページ` を出す
- トップでは既存global record launcherと下部ナビを二重表示しない
- 320px、375px、390px、768px、1280px以上でページ全体の横スクロールがない
- 200%文字拡大と ja / en / es / pt-BR の長文で内容が欠けない
- 表示中のbutton、summary、`role=button`にアクセシブルネームがある
- 「記録する」は既存の `/record` へ遷移し、記録形式は遷移後に選べる
- 公開記録カードは安全な公開位置だけを使い、blurredでは場所と時刻を抑制する
- no-JSでも記録、公開記録、記録詳細への主要リンクが機能する
- production QAはGET・HEADのみ許可し、ファイル選択後のアップロードやDB書き込みを行わない

## 配信runtimeの同期ゲート

- Nodeの `landingTop.ts` が `state-split-v1` DOMと4ロケール文言を生成する
- materialize後のCloudflare Workerが同じmarkerへD1データを注入する
- Workerはセッションをサーバー側で判定し、JavaScriptなしでguest/member表示を切り替える
- `publicPresentationPatch`、`cameraFirstHomeCta`、`publicHomeUxPolish` は新契約を旧文字列置換へ通さない
- productionとstagingのresponse headerでpresentation contractとsource SHAを確認する

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
