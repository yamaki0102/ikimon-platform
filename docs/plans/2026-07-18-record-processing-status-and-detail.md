# 投稿処理状態と個別記録ページ改善

## 目的

写真投稿後に、記録本体・写真・表示準備・AI確認の状態を混同しない。本人の個別記録ページでは、保存されたものと未完了の工程を短い状態パネルで確認できるようにする。

## 実装

- Cloudflare本番経路: 写真uploadの既存D1 batchへ `observation_reassessment_requests` のpending UPSERTを追加する。写真asset metadataと処理依頼が同じbatchで成功・失敗するため、写真だけ保存されて受付intentが欠落する状態を作らない。
- upload成功応答へ `reassessment.state=pending` を追加し、AI完了とは表示しない。
- 個別記録ページ: ログイン中のownerだけに「この記録の状態」を表示。
  - 記録: 保存済み
  - 写真: 写真なし / 表示準備中 / 保存済み / 再送が必要
  - AI: 未受付 / 受付済み / 確認中 / 候補あり / 確認済み / 確認できませんでした / 現在利用不可
- AI providerが利用できない場合は「写真と記録は保存されています。AI確認は現在利用できません。」と表示し、完了扱いにしない。
- public/non-ownerには内部処理状態を表示しない。

## 安全境界

- DB/D1 migrationを追加しない。現在のcommand-busで配備可能なactive Cloudflare upload batch内に処理を閉じる。
- 既存投稿のbackfill、production DB/R2の直接編集、secret/provider/課金設定の変更は行わない。
- 永続化するのはpending処理intentだけで、AI provider呼出しや判定完了は行わない。
- PostgreSQL互換経路のcommit後best-effort gapはactive production write pathではないため、この変更に混ぜず別途扱う。

## 検証

- 状態導出のunit test
- owner/non-owner HTML hook test
- D1 batchへpending intentが同時追加されるunit test
- D1 batch失敗時にintentだけ成功しないfailure test
- command bus dry-runでTypeScript、Node tests、Worker check/quick tests、deploy guardrailsを確認する。
