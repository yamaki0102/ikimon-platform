# 2026-04-14 v2 design alignment progress 02 (staging)

実施内容
- Nodeネイティブのまま、legacy(staging root)に寄せるコピー/見出し調整を実施。
- 対象: `/v2/about`, `/v2/learn`, `/v2/faq`, `/v2/for-business`, `/v2` top(一部)

変更ファイル
- `platform_v2/src/routes/marketing.ts`
- `platform_v2/src/app.ts`

デプロイ
- staging のみ反映（build + pm2 restart）

一致確認（legacy root vs /v2, lang=ja）
- about h2: 完全一致
  - 原体験 / まちの解像度が上がると、愛着も上がる / なぜ、地域創生なのか / 子どもだけじゃない。大人もイキイキしていないと / 消滅可能性自治体 / 持続可能なかたち
- learn h2: 完全一致
  - 自然と社会 / 健康と学び / 組織導入と分析
- faq h2: 完全一致
  - はじめての方へ / 記録・投稿 / 同定・名前 / AI支援機能 / 企業・自治体向け / データ・プライバシー / 科学データ・標本
- for-business h2: 完全一致
  - 観察記録の収集から、報告書の出力まで / どんな団体を想定しているか / プランの設計について / 3つのプラン / なぜこの料金設計なのか / よくある質問 / 導入相談も、共同実証の相談も歓迎しています。

タイトル整合
- about/learn/faq/for-business は legacy タイトルに一致（[STAGING] 接頭辞は legacy 側の仕様に準拠）

リンク整合
- `/v2` 主要5ページで bad link 0（/v2 prefix 漏れなし）

残課題
- top の h2 出現順のみ、legacy と完全一致ではない（近似まで改善済み）。
- 次段で top のセクション順・見出し順を legacy に合わせて最終調整。