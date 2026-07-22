# Record detail scene-state Visual QA

追加要件で導入した `detected / not_detected / not_assessable` と、景色記録、動画・音声、200%文字拡大を同一rendererのfixtureで確認した。

- widths: 320 / 375 / 390 / 768 / 1280px
- browser cases: 17
- locales: ja / en / es / pt-BR
- horizontal overflow: 0
- visible target under 44px: 0
- duplicate id: 0
- heading skip: 0
- coordinate locator finding: 0
- forbidden empty/absence copy: 0
- 200% text overflow: 0
- no-JavaScript: media、見出し、投稿者向けdetailsと5フォームを確認

保存画像は、景色の非検出（mobile/desktop）、判定不能、動画＋音声、200%文字拡大の代表状態。変更前画像と検出ありの変更後画像は直前run `20260723-044524/visual_qa/` に保存済み。
