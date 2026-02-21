# ikimon.life デザインシステム v2

> Stitch 7画面から抽出。2026-02-10

## カラーパレット

| Token | 用途 | Hex |
|-------|------|-----|
| `--color-primary` | CTA, アクティブ状態 | `#10b981` (Emerald) |
| `--color-primary-dark` | ホバー, リンク | `#059669` |
| `--color-secondary` | 情報, 地図マーカー | `#0ea5e9` (Sky Blue) |
| `--color-accent` | クエスト, 季節バナー | `#f59e0b` (Amber) |
| `--color-orange` | 同定待ちバッジ | `#f97316` |
| `--color-bg-base` | 背景 | `#ffffff` |
| `--color-bg-surface` | カードサーフェス | `#f8faf9` (Soft Mint) |
| `--color-text` | 本文 | `#1a2e1f` (Deep Forest) |
| `--color-text-muted` | 補助テキスト | `#64748b` (Slate) |

## タイポグラフィ

- **見出し**: `Montserrat` 700 / `Zen Kaku Gothic New` fallback
- **本文**: `Inter` 400-600 / `Noto Sans JP` fallback
- **サイズ**: Fluid Typography (`clamp()`)
  - xs: 10-12px / sm: 12-14px / base: 14-16px / lg: 16-18px / xl: 18-24px

## コンポーネントパターン

### ナビゲーション
- **トップバー**: 56px fixed, glassmorphism (`glass-nav`), ロゴ左・通知/アバター右
- **ボトムバー**: 5タブ, center FABアイコン raised（-12px top offset）, safe-area対応

### フィルタータブ
- Pill形状 (`filter-pill`), 横スクロール, アクティブ=emerald背景白文字

### フィードカード
- `feed-card` + 写真上の `badge-overlay`（黒半透明pill + blur）
- アクション行: petsアイコン + chat + 「調べる」リンク

### 季節バナー
- `amber→orange` グラデーション, 白テキスト, Material Icon装飾（低opacity）

### FAB（投稿ボタン）
- 56px, emerald gradient, `shadow-fab`, bottom-right固定

## レスポンシブ

| Breakpoint | レイアウト |
|------------|-----------|
| < 768px | シングルカラム, ボトムナビ表示 |
| 768-1024px | シングル+サイドバー |
| ≥ 1024px | 3カラム (240px左 / feed中央 / 280px右), トップナビのみ |

## Stitch画面リファレンス

| 画面 | Screen ID | デバイス |
|------|-----------|---------|
| Feed | `9a0cc5bc` | Mobile 320px |
| Post | `5a8d1a96` | Mobile 320px |
| Species Detail | `1337c8e1` | Mobile 320px |
| Zukan | `88a1ee9f` | Mobile 320px |
| Explore | `4d71ec45` | Mobile 320px |
| Profile | `d12520f5` | Mobile 320px |
| Desktop Feed | `1ab0f9a3` | Desktop 1280px |

> Stitch Project: `12595482117939951357`
