# Public home state split specification

更新日: 2026-07-23

## 決定

ログイン前トップとログイン後ホームは、目的の異なる別レイアウトとする。共通化するのはブランド、視覚トークン、公開記録カード、メディア表現、位置保護、アクセシビリティ、i18n、レスポンシブ規則だけとする。

ログイン前は、価値理解、実際の公開記録、位置保護、最初の記録への導線を担当する。ログイン後は、気軽な記録、自分の最近の記録、写真等から返った実在する発見、他者の安全な公開記録を担当する。

ログイン後ホームで、再訪、継続調査、連続記録、モニタリングを主要行動として要求しない。同じ場所の比較や変化は、条件が揃った場合に結果として自然に提示し、記録行為を強制しない。推薦read modelがない段階で「おすすめ」と表示しない。

## 配信経路

1. `platform_v2/src/app.ts` がセッションから `viewerUserId` を解決する。
2. `platform_v2/src/ui/landingTop.ts` と `landingHomeState.ts` が `state-split-v1` DOMを生成する。
3. release時にHTMLをR2へmaterializeする。
4. Cloudflare Worker `cloudflare_shadow/src/index.ts` が互換セッションを読み、D1の既存read modelをmarkerへ注入する。
5. presentation entryは新契約を旧focused-home/camera-first/copy rewriteへ通さず、そのまま返す。

Nodeだけ、またはWorkerだけの変更では完了としない。

## 表示データ

- ログイン前公開記録: public observation read modelと公開用derivative
- 最近の記録: セッション所有者の最新observation 1件
- 写真からわかったこと: 別の所有記録に存在するAI候補または確定済み名称。別記録がなければ最新カードへ統合
- 解析中: durable AI assessment/reassessment stateがqueued、processing等の場合だけ最新カード内へ表示
- 近くで残された記録: 所有record IDを除外した安全な公開記録
- 位置: `public_area_label` 等の安全な公開ラベルだけ。blurredでは場所と時刻を表示しない

環境要約は、トップ用の常時利用可能なread modelがないため常設しない。record detail等の既存面は変更しない。

## 重複排除

1. 最近の記録は自分の最新record。
2. 発見は最新とは別の解析済み自分recordを優先する。
3. 別recordがなければ発見を最近の記録へ統合し、発見セクションを省略する。
4. 近隣公開記録から自分の全record IDを除外する。
5. 1 recordの複数mediaは代表media 1件と件数表示へまとめる。

## 表示しない未実装機能

- 個人別おすすめ、専門性推薦
- 人気、いいね、地域ランキング
- 四季4時点比較、変化地点ランキング
- 常時利用可能な環境要約、過去比較
- つながり専用タブ、未実装通知、コメント

## ナビゲーション

- ログイン前ヘッダー: IKIMON、ログイン
- ログイン後ヘッダー: IKIMON、実在する通知、マイページ
- ログイン後下部: `/`、`/record`、`/records?view=public`、`/profile`
- トップでは既存global record launcherを非表示にし、二重ナビを防ぐ

## 非変更範囲

記録形式、公開記録、自分の記録、地図、フィールド、位置情報保護、公開範囲、AI解析、候補、環境解析、observation-first、community同定、多言語、認証認可、プライバシー契約を維持する。DB migration、新AI、新推薦、新通知は含めない。

## 完了ゲート

`docs/operations/public-home-ux-completion-gate.md` を正本とする。stagingのログイン前後を実ブラウザで確認し、productionは別承認まで未反映とする。
