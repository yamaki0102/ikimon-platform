# 投稿処理状態と個別記録ページ改善

## 目的

写真投稿後に、記録本体・写真・表示準備・AI確認の状態を混同しない。本人の個別記録ページでは、保存されたものと未完了の工程を短い状態パネルで確認できるようにする。

## 実装

- PostgreSQL: `evidence_assets` の写真asset作成と同じtransaction内で `media_processing_jobs` のpending intentを作成するtriggerを追加。
- Cloudflare D1: `asset_ledger` が画像upload済みになった同じtransaction/batch内で `observation_reassessment_requests` をpendingへupsertするtriggerを追加。
- 個別記録ページ: ログイン中のownerだけに「この記録の状態」を表示。
  - 記録: 保存済み
  - 写真: 写真なし / 表示準備中 / 保存済み / 再送が必要
  - AI: 未受付 / 受付済み / 確認中 / 候補あり / 確認済み / 確認できませんでした / 現在利用不可
- AI providerが利用できない場合は「写真と記録は保存されています。AI確認は現在利用できません。」と表示し、完了扱いにしない。
- public/non-ownerには内部処理状態を表示しない。

## 安全境界

- migrationは追加するが、このPR作成時点ではstaging/productionへ適用しない。
- 既存投稿のbackfill、production DB/R2の直接編集、secret/provider/課金設定の変更は行わない。
- triggerは新規・更新される写真assetの処理intentだけを冪等に作成し、AI provider呼出し自体は行わない。

## 検証

- 状態導出のunit test
- owner/non-owner HTML hook test
- PostgreSQL/D1 trigger source contract test
- PR CIでTypeScript、Node tests、Worker check/quick tests、migration guardrailsを確認する。
