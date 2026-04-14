# v2 UI/UX Global Baseline Pass 01 (staging)

日時: 2026-04-14
対象: https://staging.ikimon.life/v2/?lang=ja

## 実施内容

1. 基準の明文化
- docs/architecture/2026-04-14-ikimon-v2-uiux-global-baseline.md を追加
- legacy parity + global UX標準(ISO/Nielsen/WCAG/認知負荷)の二重基準化

2. 下層ページのトップ化防止（前回実施の継続確認）
- /about, /learn, /faq, /for-business は top hero 不使用
- 冒頭は intro section (eyebrow + h1 + lead)

3. FAQ のCTA密度調整（今回）
- カード群のリンクを厳選
- 方針系リンクは rows へ移し、主導線を整理

## 監査結果（主要5ページ）

- /v2/                  h1=1, top_hero=true,  cta_buttons=4
- /v2/about             h1=1, top_hero=false, cta_buttons=1
- /v2/learn             h1=1, top_hero=false, cta_buttons=7
- /v2/faq               h1=1, top_hero=false, cta_buttons=7 (改善前9)
- /v2/for-business      h1=1, top_hero=false, cta_buttons=8

リンク健全性:
- 全ページ bad_links=0
- 全ページ dbl_links=0

## 変更ファイル

- platform_v2/src/routes/marketing.ts
  - FAQセクションのカード/行導線を再配置

## 次アクション（pass 02）

- WCAG 2.2 AA観点の重点監査
  - フォーカス可視
  - コントラスト
  - キーボード操作
- Learn / For-business の主要CTA優先度を明示化
- KPI観測用の軽量イベント設計（first action, task completion）
