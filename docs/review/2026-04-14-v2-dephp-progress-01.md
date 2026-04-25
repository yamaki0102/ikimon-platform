# 2026-04-14 v2 de-PHP progress 01 (staging only)

実施内容
- `/v2` のトップを Node ネイティブ描画に復帰。
- `/v2/about`, `/v2/learn`, `/v2/faq`, `/v2/for-business` を runtime legacy mirror から Node ネイティブ描画へ復帰。
- runtime mirror 用の一時実装 `src/legacyMirror.ts` を削除（local + staging repo）。

変更ファイル
- `platform_v2/src/app.ts`
- `platform_v2/src/routes/marketing.ts`
- (deleted) `platform_v2/src/legacyMirror.ts`

デプロイ
- staging のみ反映（build + pm2 restart）。
- 本番 `ikimon.life` は未変更。

確認結果
- 200 OK:
  - `/v2/?lang=ja`
  - `/v2/about?lang=ja`
  - `/v2/learn?lang=ja`
  - `/v2/faq?lang=ja`
  - `/v2/for-business?lang=ja`
- 内部リンク prefix 崩れ:
  - 上記5ページすべて `bad=0`（/v2 なし内部リンクなし）
- タイトル:
  - top `[STAGING] ikimon — 近くで見つけたものを、あとで見返せる`
  - about `ikimonについて | ikimon`
  - learn `読む | ikimon`
  - faq `よくある質問 | ikimon`
  - for-business `法人向け | ikimon`

現状評価
- de-PHP（runtime mirror撤去）は達成。
- ただしデザイン一致度は mirror 時より低下（想定どおり）。
- 次は Node ネイティブのまま legacy 視覚を詰める工程へ移行。