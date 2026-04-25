# v2 UI/UX Global Baseline Pass 02 (staging)

日時: 2026-04-14
対象: https://staging.ikimon.life/v2/?lang=ja

## 目的
- WCAG 2.2 AAの基礎（キーボード操作/フォーカス可視）を先に実装
- CTA密度の高いページを整理（1画面1主目的に寄せる）

## 実施変更

1) a11y 基礎改善（全ページ共通）
- ファイル: platform_v2/src/ui/siteShell.ts
- 追加:
  - スキップリンク: `<a class="skip-link" href="#main-content">...`
  - メインランドマーク: `<main id="main-content" tabindex="-1">`
  - `:focus-visible` の可視アウトライン（a/button/input/select/btn/nav/lang switch）

2) For Business の CTA 密度調整
- ファイル: platform_v2/src/routes/marketing.ts
- 変更:
  - /for-business のカード7件のうち、説明カードを非リンク化
  - 「料金設計の背景」は rows 側へ分離
- 結果: CTAボタン数を 8 → 6 に削減

## 検証結果

主要5ページ共通:
- skip-link: 有効
- main-content id/tabindex: 有効
- focus-visible CSS: 有効
- bad_links: 0
- dbl_links: 0
- h1: 各ページ1

ページ別CTA:
- /v2/                  4
- /v2/about             1
- /v2/learn             7
- /v2/faq               7
- /v2/for-business      6

## 次アクション（Pass 03）
- Learn/FAQのCTA優先度をさらに整理（主CTA1 + 補助2程度）
- 色コントラストの実測（テキスト/リンク/ボタン）
- キーボード導線の実地テスト（tab順、skip-link到達、focus trap不在確認）
