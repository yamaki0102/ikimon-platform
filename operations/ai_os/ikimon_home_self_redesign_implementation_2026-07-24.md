# ikimon.life Home／「自分」再設計 実装・検証記録

- 日付: 2026-07-24
- ブランチ: `codex/home-self-redesign-plan-20260724`
- 基準: `origin/main` (`31e3e46e`)
- 対象: ログイン後Home、本人用「自分」、下書き引継ぎ、関連テスト
- production DB migration: 不要
- 状態: ローカル実装・検証・実装Wレビュー完了、リリース待ち

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

ローカル比較スクリーンショット:

`E:\Projects\_agent_scratch\yamaki0102-ikimon-platform\home-self-redesign-20260724\local-screenshots\`

- `guest-ja-{320,375,390,768,1280,1440}.png`
- `member-ja-{320,375,390,768,1280,1440}.png`
- `member-ja-390-sparse.png`
- `self-ja-{375,390,768,1440}.png`
- `guest-ja-390-camera-denied.png`

## 4. 実装Wレビューで確認する論点

これは自社運営・同意ベースの公開地域記録サービスに対する、防御的なセーフガード監査である。

- Homeの排他状態と「自分」の責務分離が、ユーザーの次の行動を明確にしているか。
- IndexedDB partition／guest token claimに、共有端末で別ユーザーの写真・メタデータが見える経路が残っていないか。
- 非公開、自宅、学校、私有地、希少種等の記録がHomeの写真・タイトル・再訪提案へ出ないか。
- 既存の撮影、端末画像選択、保存、認証復帰を壊す回帰がないか。
- P0として過剰実装または実体のない共有機能を混ぜていないか。
- staging／productionへ進む前に追加すべきblocking testがあるか。

## 5. リリース前の残り

- 実装Wレビューの採否反映（完了、採用ログ参照）
- commit / push / PR / merge
- 中央deploy registryの現行手順によるstaging反映
- staging authenticated QAとスクリーンショット
- production反映とread-only smoke
- 本記録へ実SHA、URL、結果、既知制約を追記
