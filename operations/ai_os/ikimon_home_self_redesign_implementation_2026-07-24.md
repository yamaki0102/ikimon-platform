# ikimon.life Home／「自分」再設計 実装・検証記録

- 日付: 2026-07-24
- ブランチ: `codex/home-self-redesign-plan-20260724`
- 基準: `origin/main` (`31e3e46e`)
- 実装PR: [#1435](https://github.com/yamaki0102/ikimon-platform/pull/1435)
- production SHA: `a4561c003f24634dc2c28d9daf900b560b809313`
- 対象: ログイン後Home、本人用「自分」、下書き引継ぎ、関連テスト
- production DB migration: 不要
- 状態: staging／production反映・production verify・対象機能read-only smoke完了

## 1. 原因

ログイン後Homeの正本は `platform_v2/src/app.ts` → `src/ui/landingTop.ts` → `src/ui/landingHomeState.ts` だった。従来の `renderMember()` は全員向け撮影カード、IndexedDB下書きカード、0件向け撮影カードを独立条件で描画していたため、同じ画面に「撮る」「続き」「撮る」が並んでいた。本人の `myFeed`、`myPlaces`、`nearbyEvents` は取得済みだったが、最上位の行動選択に使われていなかった。

本人用「自分」の正本は `platform_v2/src/routes/read.ts` の `/profile` と `renderSelfProfileHub()` だった。旧画面は最新記録、記録史、場所、Life List、貢献、設定を一ページに積み、Home・記録・場所と役割が重複していた。

撮影下書きは IndexedDB の共通キー `latest` を使っており、同一ブラウザの別アカウントへ表示され得る設計だった。

## 2. 実装

### Home

- 最上位状態を `draft_resume / recent_memory / active_context / first_record` の排他的な一状態へ整理。
- 記録ありでは本人の直近写真・日付・安全な場所ラベル・「この記録を見る」を表示。
- 直近記録を下の一覧へ重複表示しない。
- 「最近の記録」「関わっている場所」「次の活動」はデータがある時だけ表示。
- 非公開・審査前の本人写真は、場所名を消したうえで本人Homeに表示する。
- 位置保護対象または公開blockedのセンシティブな記録は、写真・タイトル・場所を自動表示せず、記録一覧への安全な導線だけを出す。
- 記録0件だけ「最初の記録を残してみましょう／撮る」を表示。
- 一般公開フィード、AI処理状態、名前待ち、内部用語を本人Homeから除外。

### 「自分」

- `/profile` を本人の写真ダッシュボードから、プロフィールと公開ページ、記録、場所、公開範囲と位置情報、参加とフォロー、アカウント設定の管理ハブへ変更。
- 記録写真や場所名を再掲せず、「記録」「場所」の正規面へ送る。
- `/profile/:userId` の公開プロフィールは変更しない。
- 共通の大きなページHeroは使わず、本人カードから管理項目へ直接入る構造にし、表示名・説明・ボタンの二重表示を解消。
- 未ログインの「自分」はサンプル指標や長い説明を撤去し、ログイン／登録だけの短い案内へ変更。

### 下書きと認証引継ぎ

- サインイン済みは `latest:user:<userId>`、未ログインは `latest:guest:<randomToken>` にpartition。
- 下書き本文にも `ownerKey` と認証継続tokenを保持し、キーと所有者の両方が一致した場合だけHomeへ表示。
- guest撮影後の認証復帰は一致tokenがある場合だけ本人partitionへrekey。
- 旧共通キー `latest` は自動claimしない。
- 撮影後は既存 `/record` の保存フローへ接続し、新しい投稿基盤は作っていない。

### コピー・i18n

- Home用の新規文言を `ja / en / es / pt-BR` の4ロケールへ同時追加。
- 内部名称 `record` はデータモデルに残し、主要画面は「記録」に統一。

## 3. 主な検証

- `npm run typecheck`: 成功
- `npm run test:node`: 1,416件成功。
- `npm run build`: 成功
- `npx playwright test -c playwright.landing-top-visual.config.ts`: 31件成功。
  - 320 / 375 / 390 / 768 / 1280 / 1440px
  - 未ログイン／ログイン済み／記録0件
  - 同一所有者下書き／別所有者下書き
  - guest token一致時だけ同一transactionで認証ユーザーへrekeyし、guest key／URL token／session tokenを消す
  - 所有者不明の旧共通キー`latest`をclaimしない
  - カメラ拒否／カメラ非対応／MediaStream停止
  - PWA standalone相当／landscape／200%文字・zoom
  - 横スクロール、44pxタップ領域、console error
- `npm run security:audit`: 既存間接依存 `find-my-way <=9.6.0` のHigh advisory 1件で終了1。今回差分による新規依存はない。
- production対象機能read-only smoke: 6件成功。
  - 公開Top 320 / 390 / 1280 / 1440px
  - 「撮る」からカメラを先に開き、ギャラリーは明示選択時だけ開く
  - 「場所を見る」の直接遷移
- production全体read-only smoke: 20件中15件成功、対象外の既存期待値5件が失敗。
  - `/learn` と `/ja/contact` は `html_not_materialized`
  - 観察詳細3件は旧表示語「AI候補」「観察記録 / 環境情報」を期待
  - `31e3e46e..a4561c00` の差分には上記route／表示語の変更がなく、今回のHome／Self差分由来ではない。

ローカル比較スクリーンショット:

`E:\Projects\_agent_scratch\yamaki0102-ikimon-platform\home-self-redesign-20260724\local-screenshots\`

- `guest-ja-{320,375,390,768,1280,1440}.png`
- `member-ja-{320,375,390,768,1280,1440}.png`
- `member-ja-390-sparse.png`
- `self-ja-{375,390,768,1440}.png`
- `guest-ja-390-camera-denied.png`

production確認スクリーンショット:

`E:\Projects\_agent_scratch\yamaki0102-ikimon-platform\home-self-redesign-20260724\production-screenshots\`

- `production-guest-home-390.png`
- `production-guest-home-1440.png`
- `production-guest-self-390.png`

変更前の提供画像:

`E:\Projects\00_all_projects_management\.codex-remote-attachments\019f8eee-0aed-70a3-9e60-0084c0771b2c\60463ff1-6537-4e5a-ae68-0c4d99037b30\1-Photo-1.jpg`

## 4. 実装Wレビューで確認する論点

これは自社運営・同意ベースの公開地域記録サービスに対する、防御的なセーフガード監査である。

- Homeの排他状態と「自分」の責務分離が、ユーザーの次の行動を明確にしているか。
- IndexedDB partition／guest token claimに、共有端末で別ユーザーの写真・メタデータが見える経路が残っていないか。
- 非公開、自宅、学校、私有地、希少種等の記録がHomeの写真・タイトル・再訪提案へ出ないか。
- 既存の撮影、端末画像選択、保存、認証復帰を壊す回帰がないか。
- P0として過剰実装または実体のない共有機能を混ぜていないか。
- staging／productionへ進む前に追加すべきblocking testがあるか。

## 5. リリース結果

- 実装コミット: `704901212ea83feb980918382baf0ce90cd7727a`
- PR: [#1435](https://github.com/yamaki0102/ikimon-platform/pull/1435)、squash merge成功
- production SHA: `a4561c003f24634dc2c28d9daf900b560b809313`
- staging dry-run: [ops #705](https://github.com/yamaki0102/all-projects-management/issues/705)、成功
- staging deploy: [ops #706](https://github.com/yamaki0102/all-projects-management/issues/706)、成功
- staging verify: [ops #707](https://github.com/yamaki0102/all-projects-management/issues/707)、成功
- staging visual QA: [ops #708](https://github.com/yamaki0102/all-projects-management/issues/708)、成功
- production dry-run: [ops #709](https://github.com/yamaki0102/all-projects-management/issues/709)、成功
- production deploy: [ops #710](https://github.com/yamaki0102/all-projects-management/issues/710)、明示承認後に成功
- production verify: [ops #712](https://github.com/yamaki0102/all-projects-management/issues/712)、成功
- DB migration: 変更なし
- GitHub Actions: 不使用。中央Cloudflare command busからimmutable SHAを反映

stagingの認証済みQAキーはローカル環境へ注入されていなかったため、秘密値を持ち出さず中央visual QAを正式証拠とした。ローカルでは認証済みHome／Selfを含む31件のブラウザE2Eを実施した。

## 6. 既知制約

- `getUserMedia()` はHTTPS・ブラウザ対応・権限許可が必要。拒否／非対応時は理由と「カメラの利用を許可する」「端末の写真から選ぶ」「キャンセル」を明示し、ギャラリーへ無言で切り替えない。
- iOS／Androidのファイルinput `capture` はOS・ブラウザ依存で、直接カメラ起動を保証しないため、「端末の写真から選ぶ」専用に限定した。
- 共有端末に残る所有者不明の旧IndexedDBキー `latest` は、別アカウントへの誤帰属を避けるため自動claim／自動削除しない。将来の同意付き整理対象。
- production全体smokeの対象外5件は、別タスクでroute materializationと旧期待値を同期する必要がある。今回のHome／Self releaseは対象機能smokeと中央verifyがgreenであり、rollback条件には該当しない。
