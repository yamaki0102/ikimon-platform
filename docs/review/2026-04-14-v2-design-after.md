# 2026-04-14 v2 Design After (staging reflected)

反映先:
- https://staging.ikimon.life/v2

反映内容:
- JA文言の優先化（タイトル・見出し・導線・フッター）
- About / Learn / FAQ / For Business のJAタイトル調整
- Topの `Today/Season/Later` -> `今日/季節/あとで`

デプロイ実行:
1. `app.ts`, `routes/marketing.ts`, `ui/siteShell.ts` をVPSへ反映
2. `npm run build` 成功
3. `pm2 restart ikimon-v2-staging-api --update-env` 実行
4. `pm2 save` 実行

確認結果:
- `/v2/?lang=ja` -> 200, title: `ikimon.life — いつもの道を、少しおもしろくする`
- `/v2/about?lang=ja` -> 200, title: `ikimonについて | ikimon v2`
- `/v2/learn?lang=ja` -> 200, title: `読む | ikimon v2`
- `/v2/faq?lang=ja` -> 200, title: `よくある質問 | ikimon v2`
- `/v2/for-business?lang=ja` -> 200, title: `法人向け | ikimon v2`

readiness:
- status: `near_ready`
- gates: all true

残課題（デザイン完成に向けた最終磨き）:
- `Methodology`, `FAQ`, `Public` など一部キーワードの英語残存（意図語かどうかの最終判定が必要）
- LearnページのJA語彙をさらに統一するなら、`Methodology` を日本語併記に寄せる余地あり
- 表示崩れを視覚確認（実ブラウザ）で最終チェック
