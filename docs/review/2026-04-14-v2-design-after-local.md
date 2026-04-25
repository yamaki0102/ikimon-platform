# 2026-04-14 v2 Design After (local patch state)

## 反映済み（ローカル）

対象ファイル:
- `platform_v2/src/app.ts`
- `platform_v2/src/routes/marketing.ts`
- `platform_v2/src/ui/siteShell.ts`

主な変更:
- JAランディングの英語見出しを日本語化
  - `Today/Season/Later` -> `今日/季節/あとで`
  - `How it works` -> `はじめ方`
  - `Learn` -> `読む`
  - `For Business` -> `法人向け`
- JAフッター文言を日本語化
- JAヘッダータグライン `Enjoy Nature` を日本語化
- MarketingルートのJAタイトル/eyebrow/カードラベルを日本語優先へ
  - About/Learn/FAQ/For Business のtitle
  - Pricing/Demo/Status/Apply などのJAラベル

## ビルド確認

- `cd platform_v2 && npm run build` -> 成功

## 未完了（要ユーザー承認）

- staging VPS への反映（ファイル転送 + build + pm2 restart）
  - 本番には一切触らない
  - stagingのみ反映して `?lang=ja` の表示を再監査予定

## 次アクション（承認後）

1. VPSへ3ファイル転送
2. `npm run build`
3. `pm2 restart ikimon-v2-staging-api --update-env`
4. `curl` で `/v2/?lang=ja`, `/v2/learn?lang=ja`, `/v2/for-business?lang=ja`, `/v2/faq?lang=ja` 再確認
5. `docs/review/2026-04-14-cutover-gate-design-only.md` を更新
