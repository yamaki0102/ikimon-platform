# 2026-04-14 v2 design alignment progress 03 (staging)

実施内容
- topページの見出し順を legacy 準拠に調整。
- `app.ts` の top body に section heading を追加し、h2の先頭順序を legacy と一致させた。

変更ファイル
- `platform_v2/src/app.ts`

反映
- staging のみ（build + pm2 restart）

検証（legacy root vs /v2, lang=ja）
- top h2 first 8:
  - legacy: ikimon へようこそ / 1.最初の足跡を残す / 2.あとで整理する / 3.場所の流れが見えてくる / さあ、始めよう / 使い方はシンプル / 近くの発見 / 数字で見る ikimon
  - v2: 同順で一致
- /v2 内部リンク prefix:
  - bad link 0

補足
- top は 9個目以降の見出しに差分が残る（v2独自セクション見出し）。
- 主要導線のリンク整合とデザイン見出しの主列は一致。