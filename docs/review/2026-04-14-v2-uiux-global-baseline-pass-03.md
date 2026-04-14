# v2 UI/UX Global Baseline Pass 03 (staging)

日時: 2026-04-14
対象: https://staging.ikimon.life/v2/?lang=ja

## 目的
- Learn / FAQ のCTA優先度をさらに整理
- コントラストを実測し、WCAG 2.2 AA観点の最低ラインを確認

## 実施変更

1) Learn のCTA整理
- ファイル: platform_v2/src/routes/marketing.ts
- 変更:
  - card内リンクを削減（情報カード化）
  - 行動導線は rows の主要2導線へ集約
  - updates 行のCTAを除去

2) FAQ のCTA整理
- ファイル: platform_v2/src/routes/marketing.ts
- 変更:
  - 「同定・名前」カードのCTAを除去（説明化）
  - 価格訴求CTAを除去（説明化）
  - 「同定の進め方」導線は rows 側へ移設

3) フォーカス可視コントラスト改善
- ファイル: platform_v2/src/ui/siteShell.ts
- 変更:
  - focus outline色を `#0ea5e9` -> `#0284c7` に変更
  - 非テキストコントラストを3:1超へ改善

## 実測コントラスト（抜粋）

- secondary text `#475569` on white: 7.58:1
- meta text `#64748b` on white: 4.76:1
- row text `#334155` on white: 10.35:1
- skip-link text white on `#0f172a`: 17.85:1
- focus outline `#0284c7` on white: 4.10:1
- focus outline `#0284c7` on footer bg `#f8fafc`: 3.91:1

## 検証結果

- /v2/                  CTA=4
- /v2/about             CTA=1
- /v2/learn             CTA=4（改善前7）
- /v2/faq               CTA=6（改善前7）
- /v2/for-business      CTA=6

共通:
- skip-link 有効
- focus-visible 有効
- bad_links=0 / dbl_links=0
- h1 は各ページ1

## 次アクション（Pass 04）
- キーボード実地導線テスト（Tab順、skip-link遷移、フォーカス移動）
- FAQ/For-businessの主CTAをさらに1段明確化
- KPI最小計測（first action / task completion）実装案の追加
